# SPIKE-3: Vercel Services -- Python FastAPI Sidecar

**Date:** 2026-03-28
**Verdict:** GO

## Summary

Vercel Services is a beta feature that allows deploying multiple independently-built services (e.g. Next.js + FastAPI) within a single Vercel project, sharing the same domain. The configuration is straightforward, Python/FastAPI is a first-class supported runtime, and the `anthropic` SDK fits well within the 500 MB bundle limit. No CORS issues arise because both services share the same origin.

---

## Key Questions Answered

### 1. Is Vercel Services GA or beta? Known limitations?

**Beta.** The configuration key is `experimentalServices` in `vercel.json`. The project's Framework Preset must be set to "Services" in the Vercel dashboard.

Known limitations:
- Beta status means the API may change
- Python and Go are tested and production-ready; other runtimes less validated
- All standard Vercel Functions limits apply to each service independently
- The `experimentalServices` key name signals this could change before GA

### 2. Can Next.js call the Python sidecar without CORS issues?

**Yes.** Both services deploy under the same domain. Vercel auto-generates environment variables:
- Server-side: `{SERVICENAME}_URL` = `https://your-deploy.vercel.app/api/ai`
- Client-side: `NEXT_PUBLIC_{SERVICENAME}_URL` = `/api/ai` (relative path, no CORS)

The client-side variables use relative paths, so browser requests stay on the same origin. No CORS configuration needed.

### 3. What's the cold start latency for a minimal FastAPI endpoint?

**Estimated 500ms-2s for cold starts.** No exact Python-specific benchmarks are published, but:
- Vercel uses Fluid Compute (enabled by default since April 2025) with bytecode caching and predictive instance warming
- Production deployments get function pre-warming
- After the first request, subsequent requests are fast (warm invocations)
- For an AI chat endpoint where the LLM response takes 1-10+ seconds, cold start is negligible

### 4. Can we install the `anthropic` Python SDK?

**Yes.** The Python bundle size limit is 500 MB (uncompressed). The `anthropic` SDK and its dependencies (httpx, pydantic, etc.) are well under 50 MB total. No issues expected.

---

## Configuration

### vercel.json

```json
{
  "experimentalServices": {
    "web": {
      "entrypoint": "frontend",
      "routePrefix": "/"
    },
    "api": {
      "entrypoint": "backend/main.py",
      "routePrefix": "/api/ai"
    }
  }
}
```

**Dashboard requirement:** Project Settings > Build & Deployment > Framework Preset must be set to **Services**.

### Project Structure

```
botcamp/
├── vercel.json                    # Services configuration (root level only)
├── frontend/                      # Next.js app
│   ├── package.json
│   ├── next.config.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   └── layout.tsx
│   │   └── lib/
│   │       └── api.ts             # Client helper: fetch(`${NEXT_PUBLIC_API_URL}/chat`)
│   └── tsconfig.json
├── backend/                       # FastAPI service
│   ├── main.py                    # Entrypoint: exposes `app = FastAPI()`
│   ├── pyproject.toml             # Dependencies (anthropic, fastapi)
│   └── routes/
│       └── chat.py                # Chat endpoint
└── public/                        # Static assets (served via CDN)
```

### Key Configuration Details

**Backend routes do NOT include the route prefix.** Vercel strips `/api/ai` before forwarding to FastAPI. So a FastAPI route `@app.post("/chat")` is reached at `https://your-app.vercel.app/api/ai/chat`.

**Frontend calls to backend** use the auto-injected env var:

```typescript
// frontend/src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/ai';

export async function chat(messages: Message[]) {
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  return res.json();
}
```

**Environment variables** set in Vercel dashboard are shared across all services. Set `ANTHROPIC_API_KEY` once and both services can read it.

---

## Python on Vercel: Details

| Property | Value |
|----------|-------|
| Supported versions | 3.12 (default), 3.13, 3.14 |
| Bundle size limit | 500 MB (uncompressed) |
| Max duration (Hobby) | 300s (5 min) |
| Max duration (Pro) | 800s (13 min) with Fluid Compute |
| Max memory (Hobby) | 2 GB / 1 vCPU |
| Max memory (Pro) | 4 GB / 2 vCPU |
| Request body limit | 4.5 MB |
| Streaming | Supported (ASGI) |
| Dependency install | pyproject.toml, requirements.txt, or Pipfile |
| Framework detection | Automatic (finds fastapi in dependencies) |
| Entrypoint files | app.py, index.py, server.py, main.py, wsgi.py, asgi.py |

### Streaming Support

FastAPI on Vercel supports streaming responses via ASGI. This is critical for AI chat: we can stream Claude's response token-by-token to the frontend using `StreamingResponse`.

### Lifespan Events

FastAPI lifespan events (startup/shutdown) are supported. Shutdown logic is limited to 500ms after SIGTERM.

---

## Local Development

```bash
vercel dev -L
```

The `-L` flag (short for `--local`) runs without authenticating with Vercel Cloud. Vercel auto-detects both services and runs them together, handling routing automatically. Each service runs in its own process.

For Python, ensure the venv is activated and dependencies installed:

```bash
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cd .. && vercel dev -L
```

---

## Gotchas and Limitations

1. **Beta status.** The `experimentalServices` key name is explicit. Configuration may change before GA. Low risk for a project at this stage.

2. **No tree-shaking for Python.** All reachable files are bundled. Use `excludeFiles` in the service config if the bundle gets large. Keep `pyproject.toml` lean.

3. **Request body limit is 4.5 MB.** Chat messages are small, so this is fine. If we later need file uploads, they'd need to go through a different path (e.g. Vercel Blob).

4. **Backend routes must NOT include the route prefix.** FastAPI routes are defined without `/api/ai` -- Vercel strips the prefix before forwarding. But the frontend must include the prefix when calling.

5. **Database migrations.** Serverless has no reliable startup event for running migrations. Run them manually or via CI. Not relevant for our use case (stateless AI proxy).

6. **Cold starts on free tier.** Hobby plan has no pre-warming guarantees. For production, Pro plan with Fluid Compute minimises cold starts.

7. **Dashboard config required.** Framework Preset must be set to "Services" in project settings, or deployment will fail with 404s.

8. **Max duration.** A Claude API call could take 30-60s for complex responses. The 300s (Hobby) / 800s (Pro) limits are more than sufficient.

---

## Fallback Plan

If Vercel Services proves unreliable or too limiting:

**Option A: Separate Vercel Projects**
- Deploy Next.js and FastAPI as two separate Vercel projects
- Each gets its own `*.vercel.app` domain
- Requires CORS configuration on the FastAPI side
- Slightly more complex but fully GA, well-documented

**Option B: Hetzner Deployment**
- Deploy FastAPI to existing Hetzner server (jfritz.xyz)
- Next.js stays on Vercel (or also moves to Hetzner)
- Full control over Python environment, no cold starts
- More ops overhead (systemd, nginx, SSL)
- Existing deployment patterns from Stellaris and Protokoll-Assistent

**Option C: Next.js API Routes Only**
- Use Next.js API routes (Node.js) as the AI proxy
- Call Claude API via the TypeScript/JavaScript `@anthropic-ai/sdk`
- No Python needed at all
- Loses the ability to use Python-specific AI libraries
- Simplest architecture if Python isn't strictly required

**Recommendation:** Start with Vercel Services. If it fails, Option C (Next.js API routes with the JS Anthropic SDK) is the simplest fallback. Option B (Hetzner) is the fallback if we need Python specifically.

---

## Decision

**GO.** Vercel Services meets all requirements:
- Deploys Next.js + FastAPI under one domain
- No CORS issues
- 500 MB bundle limit accommodates the `anthropic` SDK easily
- Streaming support for real-time AI responses
- `vercel dev -L` for local development
- Auto-generated environment variables for cross-service communication
- Cold starts are acceptable given AI response latency dominates

The beta status is the only concern, but the feature is actively maintained, well-documented, and our use case (Next.js + FastAPI) is the exact example in their docs.
