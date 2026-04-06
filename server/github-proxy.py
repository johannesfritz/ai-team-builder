#!/usr/bin/env python3
"""GitHub OAuth proxy + Gist API for AI Team Builder.
Runs on Hetzner alongside nginx. Keeps client_secret server-side.
"""

import os
import re
import time
from typing import Any

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

app = FastAPI()

# --- Config ---
GITHUB_CLIENT_ID = os.environ["GITHUB_CLIENT_ID"]
GITHUB_CLIENT_SECRET = os.environ["GITHUB_CLIENT_SECRET"]
APP_URL = "https://jfritz.xyz/ai-team-builder/builder"
CALLBACK_URL = "https://jfritz.xyz/ai-team-builder/api/auth/callback"
GITHUB_API = "https://api.github.com"

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://jfritz.xyz"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# --- Rate limiting (in-memory, IP-based, 100 req/hr) ---
rate_store: dict[str, list[float]] = {}
RATE_LIMIT = 100
RATE_WINDOW = 3600


def check_rate_limit(ip: str) -> bool:
    now = time.time()
    hits = rate_store.get(ip, [])
    hits = [t for t in hits if now - t < RATE_WINDOW]
    if len(hits) >= RATE_LIMIT:
        return False
    hits.append(now)
    rate_store[ip] = hits
    return True


# --- Route allowlist ---
ALLOWED_PATHS = [
    re.compile(r"^/user/repos$"),
    re.compile(r"^/gists$"),
    re.compile(r"^/repos/[^/]+/[^/]+/git/(trees|commits|refs(/heads/.+)?)$"),
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

@app.api_route("/github/{path:path}", methods=["POST"])
async def proxy_github(path: str, request: Request) -> Response:
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
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

    body = await request.body()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GITHUB_API}{api_path}",
            content=body,
            headers={
                "Authorization": auth_header,
                "Accept": "application/vnd.github+json",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type="application/json",
    )


# --- Health ---

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3848)
