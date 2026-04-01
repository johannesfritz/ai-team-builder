# ADR-008: Deployment — Vercel (Primary) with Vercel Services

**Status:** Accepted
**Date:** 2026-03-28
**Decision Makers:** Solutions Architect (Claude)

---

## Institutional Memory Check

Related ADRs:
- Metis server README: Dedicated Hetzner VPS for autonomous agent workloads. Demonstrates existing Hetzner infrastructure.
- Stellaris CLAUDE.md: Deployed to Hetzner VPS (jfritz.xyz) with manual rsync + systemd. No CI/CD.
- Iran monitor: Frontend deployed to Vercel (via Nuxt), backend on Hetzner.

Consistency Analysis:
- Existing projects split between Hetzner (manual deploy) and Vercel (automated). Bot the Builder is a SaaS product that benefits from Vercel's automated deployment, preview environments, and edge network. Hetzner is inappropriate for a scaling SaaS frontend.

Divergence Justification:
- Hetzner is excellent for dedicated workloads (autonomous agents, persistent servers) but wrong for a SaaS that needs auto-scaling, preview deployments per PR, edge CDN, and zero-downtime deployments. Vercel is the right tool here.

---

## Context

Bot the Builder needs:

| Requirement | Why |
|-------------|-----|
| **Auto-scaling** | Marketplace traffic is unpredictable |
| **Preview deployments** | Every PR gets a preview URL for testing |
| **Edge CDN** | Marketplace pages must load fast globally |
| **Zero-downtime deploys** | SaaS must not go offline during deploys |
| **Serverless functions** | API routes scale to zero when idle |
| **Python runtime** | AI service needs Python (ADR-002) |

---

## Decision

Deploy on **Vercel** using **Vercel Services** to run the Next.js app and Python AI service as a single project.

---

## Options Considered

### Option A: Vercel (Full) — SELECTED

**Pros:**
- Native Next.js deployment (zero config)
- Vercel Services supports Next.js + Python in one project
- Preview deployments per PR (automatic)
- Edge CDN for marketplace pages
- Auto-scaling serverless functions
- Neon database integration (Vercel Marketplace)
- GitHub integration (auto-deploy on push)
- Web Analytics and Speed Insights built in

**Cons:**
- Cost at scale: Pro plan $20/team/month + usage-based compute
- Vendor lock-in (mitigated: Next.js can self-host, Python is standard FastAPI)
- Serverless cold starts (~200ms for Node.js, ~500ms for Python)
- Function timeout limits (60s default, 300s max on Pro)

### Option B: Hetzner VPS (Self-Hosted)

**Pros:**
- Low fixed cost (~EUR 15/month for CPX32)
- Full control over infrastructure
- No vendor lock-in
- Existing infrastructure and operational knowledge

**Cons:**
- No auto-scaling — must provision for peak load
- No preview deployments (must build CI/CD from scratch)
- No edge CDN (single datacenter)
- Manual deploys (rsync + systemd — proven failure mode in this codebase)
- Must manage SSL, nginx, process management, monitoring
- Single point of failure (one server)

### Option C: Hybrid (Vercel Frontend + Hetzner Backend)

**Pros:**
- Vercel handles frontend scaling and CDN
- Hetzner handles long-running LLM tasks without function timeouts

**Cons:**
- Two deployment targets (doubled operational complexity)
- CORS between Vercel and Hetzner
- Must manage Hetzner server separately
- Network latency between Vercel edge and Hetzner datacenter

### Option D: AWS/GCP/Azure

**Pros:**
- Maximum flexibility and service breadth
- Enterprise-grade infrastructure

**Cons:**
- Massively over-engineered for MVP
- Complex to configure (VPCs, IAM, load balancers)
- Higher cost than Vercel for equivalent functionality
- No Next.js-native deployment experience
- Team has no AWS/GCP operational experience

---

## Consequences

### Positive

1. **Zero DevOps for MVP** — deploy by pushing to GitHub
2. **Preview deployments** — every PR gets a URL, testing before merge
3. **Database branches** — Neon branches per preview deployment
4. **Global CDN** — marketplace pages served from edge
5. **Auto-scaling** — handles traffic spikes without provisioning
6. **Observability** — built-in analytics, speed insights, runtime logs

### Negative

1. **Cost at scale** — more expensive than self-hosting if traffic is high and sustained
2. **Function timeouts** — LLM operations limited to 300s (Pro plan). Machine improvement loops that exceed this need chunking.
3. **Vendor coupling** — deep Vercel integration. Migration requires effort (but not impossible — Next.js self-hosts, Python is portable).

### Trade-off

Hetzner is cheaper at steady-state but requires significant DevOps investment (CI/CD, monitoring, scaling). Vercel is more expensive per-request but eliminates all operational overhead. For an MVP that may or may not find product-market fit, minimizing operational cost (human time) is more important than minimizing compute cost (dollars). If the product succeeds, the Vercel bill is a rounding error compared to revenue. If it fails, we avoided building infrastructure for nothing.

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

### Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | Neon (Vercel Marketplace) | PostgreSQL connection |
| `NEXTAUTH_SECRET` | Manual | Session encryption |
| `GITHUB_CLIENT_ID` | Manual | OAuth app |
| `GITHUB_CLIENT_SECRET` | Manual | OAuth app |
| `STRIPE_SECRET_KEY` | Manual | Payments |
| `STRIPE_WEBHOOK_SECRET` | Manual | Webhook verification |
| `ANTHROPIC_API_KEY` | Manual | Claude API for AI service |
| `AI_URL` | Auto (Vercel Services) | Python service URL |

### CI/CD Flow

```
Push to main → Vercel builds both services → Deploy to production
Push to PR branch → Vercel builds both services → Deploy to preview URL
                  → Neon creates database branch → Preview uses branch DB
```

### Cost Estimate (MVP)

| Component | Monthly Cost |
|-----------|-------------|
| Vercel Pro | $20/team |
| Neon Free Tier | $0 |
| Vercel Functions (low traffic) | ~$5 |
| Vercel Bandwidth (low traffic) | ~$5 |
| **Total** | **~$30/month** |

At scale (10,000 MAU): estimated $100-300/month depending on function invocations and bandwidth.

---

## Related ADRs

- ADR-001: Frontend Framework (Next.js)
- ADR-002: Backend Architecture (Vercel Services for dual runtime)
- ADR-003: Database (Neon via Vercel Marketplace)
