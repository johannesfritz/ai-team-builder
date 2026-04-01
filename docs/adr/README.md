# Bot the Builder — Architecture Decision Records

**Date:** 2026-03-28
**Product:** Visual no-code builder for Claude Code coworker plugins with marketplace

---

## Decision Summary

| ADR | Decision | Key Trade-off |
|-----|----------|---------------|
| [ADR-001](ADR-001-frontend-framework.md) | **Next.js (App Router)** | Builder gets no SSR benefit, but marketplace and platform gain SEO + server components. One framework for three surfaces beats two separate apps. |
| [ADR-002](ADR-002-backend-architecture.md) | **Next.js API Routes + Python Sidecar** (Vercel Services) | Two languages in one project, but TypeScript for web plumbing and Python for AI matches team strengths. |
| [ADR-003](ADR-003-database.md) | **PostgreSQL via Neon** (Drizzle ORM) | New technology for team (all prior work used SQLite), but SQLite is fundamentally wrong for multi-user serverless SaaS. |
| [ADR-004](ADR-004-plugin-storage-distribution.md) | **GitHub Repos** (native) | GitHub dependency, but Claude Code already requires GitHub for plugin installation. Zero friction. |
| [ADR-005](ADR-005-authentication.md) | **NextAuth.js + GitHub OAuth** | No pre-built UI components, but zero per-user cost and GitHub tokens serve double duty (auth + repo access). |
| [ADR-006](ADR-006-payment-processing.md) | **Stripe Connect (Standard)** | Creator onboarding friction (must have Stripe account), but lowest platform liability and industry standard. |
| [ADR-007](ADR-007-visual-builder-engine.md) | **React Flow (@xyflow/react)** | $299/year Pro license + large bundle, but saves 6+ months of custom canvas engineering. |
| [ADR-008](ADR-008-deployment.md) | **Vercel** (with Vercel Services) | Higher cost than self-hosting at scale, but zero DevOps overhead and preview deployments per PR. |
| [ADR-009](ADR-009-ai-integration.md) | **Claude API via Vercel AI SDK** | Single provider risk, but dog-fooding (Claude understands Claude Code best). |

---

## Architecture Overview

```
                         ┌─────────────────────────┐
                         │      Vercel Edge CDN     │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                  │
              ┌─────▼─────┐   ┌──────▼──────┐   ┌──────▼──────┐
              │  Builder   │   │  Platform   │   │ Marketplace │
              │ (client)   │   │  (mixed)    │   │   (SSR)     │
              │ React Flow │   │ Dashboard   │   │ Discovery   │
              └─────┬─────┘   └──────┬──────┘   └──────┬──────┘
                    │                 │                  │
                    └─────────────────┼──────────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │   Next.js API Routes    │
                         │  (TypeScript — CRUD,    │
                         │   Auth, Payments, Git)  │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                  │
              ┌─────▼─────┐   ┌──────▼──────┐   ┌──────▼──────┐
              │   Neon     │   │   GitHub    │   │   Stripe    │
              │ PostgreSQL │   │    App      │   │  Connect    │
              └───────────┘   └─────────────┘   └─────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │   Python AI Service     │
                         │  (FastAPI — Dry Run,    │
                         │   Improve, AI Config)   │
                         └────────────┬────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │    Claude API           │
                         │  (Sonnet + Opus)        │
                         └─────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | ADR |
|-------|-----------|-----|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS | ADR-001 |
| Visual Builder | React Flow (@xyflow/react v12) | ADR-007 |
| UI Components | shadcn/ui | — |
| State Management | Zustand (builder state) + React Flow (graph state) | ADR-007 |
| Backend (Web) | Next.js API Routes (TypeScript) | ADR-002 |
| Backend (AI) | FastAPI (Python 3.11+) via Vercel Services | ADR-002 |
| Database | PostgreSQL (Neon) via Drizzle ORM | ADR-003 |
| Auth | NextAuth.js v5 + GitHub OAuth | ADR-005 |
| Payments | Stripe Connect (Standard) | ADR-006 |
| Plugin Storage | GitHub Repos (native) | ADR-004 |
| AI | Claude API (Sonnet + Opus) via AI SDK + Anthropic Python SDK | ADR-009 |
| Deployment | Vercel (Services) | ADR-008 |

---

## Reversibility Assessment

| Decision | Reversibility | Cost to Reverse |
|----------|--------------|-----------------|
| Next.js | Medium | Can migrate to Vite SPA, but lose SSR/server components |
| PostgreSQL/Neon | High | Standard Postgres, portable to any host |
| GitHub distribution | High | Can add alternative channels alongside |
| NextAuth.js | Medium | Auth migration is painful but doable |
| Stripe Connect | Low | Payment provider migration is very expensive |
| React Flow | Medium | Can swap rendering engine, keep data model |
| Vercel deployment | High | Next.js self-hosts, Python is portable |
| Claude API | High | AI SDK abstracts provider, can swap |

**Most irreversible decision:** Stripe Connect. Payment integrations are deeply woven into business logic and hard to change. Chosen carefully.

---

## MVP Scope

For the first release, focus on:

1. **Builder** — Create plugins visually (hooks, rules, skills)
2. **Platform** — Publish to GitHub, version management
3. **Marketplace** — Browse and install free plugins only

Deferred to post-MVP:
- Paid plugins (Stripe integration)
- Real-time collaborative editing
- Machine improvement loops (Opus-powered)
- Plugin analytics and usage tracking

---

## Estimated Monthly Cost (MVP)

| Component | Cost |
|-----------|------|
| Vercel Pro | $20 |
| Neon Free Tier | $0 |
| Vercel Functions | ~$5 |
| Claude API (low usage) | ~$50 |
| React Flow Pro | $25 ($299/yr) |
| GitHub App | $0 |
| Domain | ~$1 |
| **Total** | **~$100/month** |
