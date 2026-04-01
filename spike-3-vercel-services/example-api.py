"""
BotCamp FastAPI Sidecar — Minimal Example

This is a minimal FastAPI app demonstrating the AI chat endpoint
for Vercel Services deployment. The app is mounted at /api/ai by
Vercel, so all routes here are relative (no /api/ai prefix).

Entrypoint: backend/main.py (referenced in vercel.json)
"""

import os
from contextlib import asynccontextmanager

import anthropic
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel


# --- Lifespan (startup/shutdown) ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup, clean up on shutdown."""
    # Startup: validate API key is present
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("ANTHROPIC_API_KEY environment variable is required")
    print("FastAPI sidecar started")
    yield
    # Shutdown (max 500ms on Vercel)
    print("FastAPI sidecar shutting down")


app = FastAPI(
    title="BotCamp AI API",
    lifespan=lifespan,
)


# --- Models ---

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 4096


class ChatResponse(BaseModel):
    content: str
    model: str
    usage: dict


# --- Routes ---
# NOTE: No /api/ai prefix here. Vercel strips the routePrefix
# before forwarding requests to this service.

@app.get("/health")
async def health():
    """Health check endpoint. Accessible at /api/ai/health."""
    return {"status": "ok", "service": "botcamp-ai"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Non-streaming chat endpoint.
    Accessible at POST /api/ai/chat.
    """
    client = anthropic.Anthropic()  # Uses ANTHROPIC_API_KEY from env

    try:
        response = client.messages.create(
            model=request.model,
            max_tokens=request.max_tokens,
            messages=[{"role": m.role, "content": m.content} for m in request.messages],
        )
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {e.message}")

    return ChatResponse(
        content=response.content[0].text,
        model=response.model,
        usage={
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        },
    )


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Streaming chat endpoint. Returns Server-Sent Events.
    Accessible at POST /api/ai/chat/stream.

    Vercel supports streaming responses via ASGI.
    """
    client = anthropic.Anthropic()

    async def generate():
        try:
            with client.messages.stream(
                model=request.model,
                max_tokens=request.max_tokens,
                messages=[{"role": m.role, "content": m.content} for m in request.messages],
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {text}\n\n"
            yield "data: [DONE]\n\n"
        except anthropic.APIError as e:
            yield f"data: [ERROR] {e.message}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


# --- Companion pyproject.toml ---
# Place this in backend/pyproject.toml:
#
# [project]
# name = "botcamp-api"
# version = "0.1.0"
# requires-python = ">=3.12"
# dependencies = [
#     "fastapi>=0.117.1",
#     "anthropic>=0.49.0",
# ]
