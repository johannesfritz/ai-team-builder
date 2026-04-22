#!/usr/bin/env python3
"""GitHub OAuth proxy + Anthropic forwarder for AI Team Builder.
Runs on Hetzner alongside nginx. Keeps client_secret server-side.

Endpoints (as FastAPI sees them, AFTER nginx strips /ai-team-builder/api/):
  GET  /auth/github                - OAuth initiation
  GET  /auth/callback              - OAuth callback
  {POST,PATCH,GET} /github/{path}  - GitHub API proxy (writes + branches)
  POST /anthropic/messages         - Anthropic Messages API forwarder (SSE streaming)
  GET  /health                     - Health check

Browser-facing URLs (through nginx):
  https://jfritz.xyz/ai-team-builder/api/anthropic/messages
  https://jfritz.xyz/ai-team-builder/api/github/{path}

The Anthropic forwarder streams responses back to the client via SSE and
propagates client disconnects to the upstream httpx stream so Anthropic
billing stops within ~100ms of cancel.

Nginx must have `proxy_buffering off` for `/ai-team-builder/api/anthropic/`
or the streaming will be collapsed.
"""

import asyncio
import json
import os
import re
import time
from typing import AsyncIterator

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse

app = FastAPI()

# --- Config ---
GITHUB_CLIENT_ID = os.environ["GITHUB_CLIENT_ID"]
GITHUB_CLIENT_SECRET = os.environ["GITHUB_CLIENT_SECRET"]
APP_URL = "https://jfritz.xyz/ai-team-builder/builder"
CALLBACK_URL = "https://jfritz.xyz/ai-team-builder/api/auth/callback"
GITHUB_API = "https://api.github.com"
ANTHROPIC_API = "https://api.anthropic.com"
ANTHROPIC_VERSION = "2023-06-01"

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://jfritz.xyz"],
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Anthropic-Key"],
)

# --- Rate limiting (in-memory, IP-based) ---
# Two buckets: default (GitHub passthrough + misc) and stricter anthropic bucket.
rate_store_github: dict[str, list[float]] = {}
rate_store_anthropic: dict[str, list[float]] = {}
RATE_LIMIT_GITHUB = 300  # per hour, raised from 100 for Sprint 4 git-sync mutations
RATE_LIMIT_ANTHROPIC = 60  # per hour, stricter because each request costs the user money
RATE_WINDOW = 3600


def _check_bucket(store: dict[str, list[float]], ip: str, limit: int) -> bool:
    now = time.time()
    hits = store.get(ip, [])
    hits = [t for t in hits if now - t < RATE_WINDOW]
    if len(hits) >= limit:
        store[ip] = hits
        return False
    hits.append(now)
    store[ip] = hits
    return True


def check_github_rate(ip: str) -> bool:
    return _check_bucket(rate_store_github, ip, RATE_LIMIT_GITHUB)


def check_anthropic_rate(ip: str) -> bool:
    return _check_bucket(rate_store_anthropic, ip, RATE_LIMIT_ANTHROPIC)


# --- Route allowlist (GitHub) ---
ALLOWED_PATHS = [
    re.compile(r"^/user/repos$"),
    re.compile(r"^/gists$"),
    re.compile(r"^/repos/[^/]+/[^/]+/git/(trees|commits|refs(/heads/.+)?)$"),
    # Sprint 4: branch protection introspection (GET).
    re.compile(r"^/repos/[^/]+/[^/]+/branches/[^/]+$"),
]


def is_allowed_path(path: str) -> bool:
    return any(p.match(path) for p in ALLOWED_PATHS)


# --- OAuth endpoints ---

@app.get("/auth/github")
async def auth_github() -> RedirectResponse:
    url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={CALLBACK_URL}"
        f"&scope=repo,gist"
    )
    return RedirectResponse(url)


@app.get("/auth/callback")
async def auth_callback(code: str) -> RedirectResponse:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
    data = resp.json()
    token = data.get("access_token", "")
    error = data.get("error", "")
    if error or not token:
        return RedirectResponse(f"{APP_URL}?auth_error={error or 'no_token'}")
    return RedirectResponse(f"{APP_URL}#github_token={token}")


# --- GitHub API proxy ---
# Accepts POST (tree/commit/gist creation), PATCH (ref update), GET (branch
# protection). Writes are what we care most about auditing; reads are direct
# from the browser except for branch-protection introspection.

@app.api_route("/github/{path:path}", methods=["POST", "PATCH", "GET"])
async def proxy_github(path: str, request: Request) -> Response:
    client_ip = request.client.host if request.client else "unknown"
    if not check_github_rate(client_ip):
        return Response(
            content='{"error":"rate_limit_exceeded"}',
            status_code=429,
            media_type="application/json",
        )

    api_path = f"/{path}"
    if not is_allowed_path(api_path):
        return Response(
            content='{"error":"path_not_allowed"}',
            status_code=403,
            media_type="application/json",
        )

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return Response(
            content='{"error":"missing_token"}',
            status_code=401,
            media_type="application/json",
        )

    method = request.method
    body: bytes | None = None
    if method in ("POST", "PATCH"):
        body = await request.body()

    headers: dict[str, str] = {
        "Authorization": auth_header,
        "Accept": "application/vnd.github+json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"

    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method,
            f"{GITHUB_API}{api_path}",
            content=body,
            headers=headers,
            timeout=30.0,
        )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type="application/json",
    )


# --- Anthropic Messages API forwarder (SSE streaming) ---
# Sprint 3. Browser sends user's API key in X-Anthropic-Key header; we forward
# to Anthropic with the key in x-api-key. We never log the key. On client
# disconnect we close the upstream stream within ~100ms so Anthropic billing
# stops.

@app.post("/anthropic/messages")
async def proxy_anthropic_messages(request: Request) -> Response:
    client_ip = request.client.host if request.client else "unknown"
    if not check_anthropic_rate(client_ip):
        return Response(
            content='{"error":{"type":"rate_limit_exceeded","message":"proxy rate limit"}}',
            status_code=429,
            media_type="application/json",
        )

    api_key = request.headers.get("X-Anthropic-Key", "").strip()
    if not api_key:
        return Response(
            content='{"error":{"type":"missing_key","message":"X-Anthropic-Key header required"}}',
            status_code=401,
            media_type="application/json",
        )

    try:
        body_json = await request.json()
    except json.JSONDecodeError:
        return Response(
            content='{"error":{"type":"invalid_json","message":"body must be JSON"}}',
            status_code=400,
            media_type="application/json",
        )

    # Whitelist fields we forward; drop anything else silently.
    allowed_fields = {
        "model",
        "messages",
        "system",
        "max_tokens",
        "temperature",
        "top_p",
        "top_k",
        "stream",
        "stop_sequences",
        "metadata",
        "tools",
        "tool_choice",
    }
    sanitized = {k: v for k, v in body_json.items() if k in allowed_fields}
    # Force stream=true; the client always wants streaming in v1.
    sanitized["stream"] = True

    async def relay() -> AsyncIterator[bytes]:
        client = httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=None, write=30.0, pool=10.0))
        try:
            async with client.stream(
                "POST",
                f"{ANTHROPIC_API}/v1/messages",
                json=sanitized,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": ANTHROPIC_VERSION,
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                    # CRITICAL: httpx defaults to Accept-Encoding: gzip,deflate which
                    # makes Anthropic return gzipped bytes. Since we forward raw bytes
                    # via aiter_raw() without a Content-Encoding header, the browser
                    # can't decompress them and the SSE parser fails. Pin to identity.
                    "Accept-Encoding": "identity",
                },
            ) as resp:
                # If Anthropic returned a non-200, propagate the body as a single
                # SSE error event so the client can surface it uniformly.
                if resp.status_code >= 400:
                    text = await resp.aread()
                    yield (
                        b"event: error\n"
                        b"data: " + text + b"\n\n"
                    )
                    return
                async for chunk in resp.aiter_raw():
                    if await request.is_disconnected():
                        # Client gone — close upstream via context-manager exit.
                        return
                    if chunk:
                        yield chunk
        except (httpx.ConnectError, httpx.ReadError, httpx.WriteError) as e:
            # Upstream failure — send a synthetic error event so the client
            # sees something actionable instead of a closed stream.
            yield b"event: error\ndata: " + json.dumps(
                {"type": "error", "error": {"type": "upstream_error", "message": str(e)}}
            ).encode() + b"\n\n"
        except asyncio.CancelledError:
            # Normal on client disconnect; re-raise for FastAPI to finish cleanly.
            raise
        finally:
            await client.aclose()

    return StreamingResponse(
        relay(),
        media_type="text/event-stream",
        headers={
            # Belt-and-suspenders: disable nginx buffering for this response.
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
        },
    )


# --- Health ---

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3848)
