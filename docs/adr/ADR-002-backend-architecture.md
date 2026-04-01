# ADR-002: Backend Architecture — Next.js API Routes + Vercel Functions with Python Sidecar

**Status:** Accepted
**Date:** 2026-03-28
**Decision Makers:** Solutions Architect (Claude)

---

## Institutional Memory Check

Related ADRs:
- ADR-2026-001 (Dual-Database): Chose FastAPI + REST API as the single ingestion entry point for the shadow system. Demonstrates preference for FastAPI for data-heavy backends.
- FRIDAY architecture: Uses FastAPI for pipeline orchestration and search endpoints.
- Stellaris: FastAPI backend with SQLite.

Consistency Analysis:
- The existing codebase is heavily FastAPI/Python for backends. This decision uses Next.js API routes as the primary backend, which is a deliberate divergence.

Divergence Justification:
- Bot the Builder's primary backend workload is CRUD (users, plugins, marketplace) and file generation (assembling `.claude/` directories). These are well-served by Next.js API routes collocated with the frontend. The LLM-intensive operations (dry run simulation, machine improvement) are better served by a Python sidecar deployed as a Vercel Function (Python runtime) or a separate service, keeping the LLM pipeline in the language the team is most proficient with for AI work.

---

## Context

The backend must handle several distinct workload types:

| Workload | Characteristics | Volume |
|----------|----------------|--------|
| **CRUD** | Users, plugins, versions, ratings, marketplace | High frequency, low compute |
| **File generation** | Assemble `.claude/` directory from builder config | Medium frequency, I/O bound |
| **Git operations** | Push plugin packages to GitHub repos | Medium frequency, I/O bound |
| **LLM calls** | Dry run simulation, machine improvement, AI-assisted config | Low frequency, high latency (10-60s) |
| **Payments** | Stripe integration for marketplace | Low frequency, must be reliable |

---

## Decision

Use a **hybrid architecture**:

1. **Next.js API routes** (TypeScript) — CRUD, file generation, Git operations, payments, auth
2. **Python service** (FastAPI on Vercel Functions) — LLM-intensive operations (dry run, machine improvement, AI-assisted generation)

Deploy as a Vercel Services configuration with the Next.js app as the primary service and the Python backend as a secondary service at `/api/ai/`.

---

## Options Considered

### Option A: Next.js API Routes Only (Monolith)

**Pros:**
- Simplest architecture — one codebase, one deployment
- Shared types between frontend and backend
- No service-to-service communication overhead

**Cons:**
- LLM orchestration in TypeScript is less mature than Python (Anthropic Python SDK is first-class)
- Team is more proficient in Python for AI/ML work
- Serverless function timeouts may not accommodate long LLM chains (machine improvement loops)

### Option B: FastAPI (Python) Only

**Pros:**
- Consistent with existing projects (Stellaris, shadow-api, FRIDAY)
- Team's strongest backend language
- Excellent async support, Anthropic SDK is native

**Cons:**
- Separate deployment from frontend (CORS, two domains or reverse proxy)
- No type sharing with frontend
- Need separate infrastructure for SSR (if Next.js frontend calls Python backend at build time)

### Option C: Hybrid — Next.js + Python Sidecar — SELECTED

**Pros:**
- CRUD stays collocated with frontend (type safety, no CORS)
- LLM work runs in Python where the team and tooling are strongest
- Vercel Services deploys both as one project (shared domain, no CORS)
- Clean separation of concerns: TypeScript for web plumbing, Python for AI
- Python service can use longer timeouts (`maxDuration`) independently

**Cons:**
- Two languages in one project (higher cognitive load)
- Service-to-service calls add latency for AI operations
- Must coordinate deployments (though Vercel Services handles this)

### Option D: Microservices (separate services for auth, plugins, marketplace, AI)

**Rejected** — over-engineering for MVP. Premature decomposition creates operational overhead without corresponding benefit at this scale. Can decompose later if specific services need independent scaling.

---

## Consequences

### Positive

1. **Right tool for each job** — TypeScript for web, Python for AI
2. **Single deployment** — Vercel Services bundles both under one domain
3. **Type safety** — Next.js API routes share types with frontend via imports
4. **LLM flexibility** — Python sidecar can use long timeouts, streaming, and the full Anthropic SDK
5. **Team alignment** — matches existing skill distribution

### Negative

1. **Two languages** — contributors must be comfortable in both TypeScript and Python
2. **Integration overhead** — service-to-service calls between Next.js and Python require API contracts
3. **Deployment coupling** — both services deploy together (acceptable for MVP, may need decoupling later)

### Trade-off

The hybrid approach is more complex than a monolith but avoids the worst failure mode: writing complex LLM orchestration in a language where the team is less proficient. The CRUD/web layer (80% of requests) stays in TypeScript with full type safety. The AI layer (20% of requests, 80% of compute) stays in Python where the tooling is mature.

---

## Implementation Notes

### Vercel Services Configuration

```json
{
  "experimentalServices": {
    "web": {
      "entrypoint": ".",
      "routePrefix": "/"
    },
    "ai": {
      "entrypoint": "services/ai/main.py",
      "routePrefix": "/api/ai",
      "maxDuration": 300,
      "memory": 1024
    }
  }
}
```

### Service Communication

- Next.js API routes call the Python service via `AI_URL` environment variable (auto-generated by Vercel Services)
- Python service is stateless — all state in the database
- Long-running LLM operations use streaming responses (SSE) back to the client

### Directory Structure

```
bot-the-builder/
├── app/                    # Next.js App Router (frontend + API routes)
│   ├── api/               # TypeScript API routes (CRUD, auth, payments)
│   └── ...                # Pages
├── services/
│   └── ai/                # Python FastAPI service
│       ├── main.py        # FastAPI app
│       ├── dry_run.py     # Dry run simulation
│       ├── improve.py     # Machine improvement loops
│       └── pyproject.toml # Python dependencies
├── lib/                   # Shared TypeScript utilities
├── vercel.json
└── package.json
```

---

## Related ADRs

- ADR-001: Frontend Framework
- ADR-003: Database
- ADR-008: Deployment
- ADR-009: AI Integration
