# ADR-001: Frontend Framework — Next.js (App Router)

**Status:** Accepted
**Date:** 2026-03-28
**Decision Makers:** Solutions Architect (Claude)

---

## Institutional Memory Check

Related ADRs:
- Stellaris ADR-001/002: Stellaris uses React + Vite SPA with FastAPI backend. Demonstrates the team's comfort with React + TypeScript.
- FRIDAY architecture guide: Frontend components (hotel-de-ville, my-ai-village) use React. The existing stack is React-native.

Consistency Analysis:
- This decision introduces Next.js (App Router), which is new to the codebase. All existing projects use either Vite SPAs or Nuxt (iran-monitor frontend). This is a justified divergence.

Divergence Justification:
- Bot the Builder is a multi-surface product (builder, platform, marketplace) that benefits from SSR for SEO (marketplace discovery), server components for reduced client bundle, and API routes for lightweight backend-for-frontend. A pure SPA would require a separate SSR layer for marketplace pages, duplicating routing logic.

---

## Context

Bot the Builder has three product surfaces with different rendering requirements:

| Surface | Rendering Need | Why |
|---------|---------------|-----|
| **Builder** | Client-heavy (SPA-like) | Complex drag-and-drop canvas, real-time preview, heavy state |
| **Platform** | Mixed (SSR + client) | Plugin pages need SEO, dashboard is interactive |
| **Marketplace** | SSR-first | Discovery pages must be crawlable, fast first paint for conversion |

The builder is the most complex surface — it needs a performant canvas with drag-and-drop, real-time preview panels, and deep state management (workflow graph + settings + preview output). The marketplace needs SEO. The platform dashboard needs interactivity.

---

## Decision

Use **Next.js with App Router** as the frontend framework.

---

## Options Considered

### Option A: Next.js (App Router) — SELECTED

**Pros:**
- Server Components reduce client bundle for marketplace/platform pages
- Built-in SSR/SSG for marketplace SEO without separate infrastructure
- API routes serve as backend-for-frontend, reducing round trips
- App Router's layout system maps cleanly to the three surfaces (builder, platform, marketplace)
- Vercel deployment is native (zero-config)
- React Server Components can stream plugin metadata without client JS
- Massive ecosystem and community support

**Cons:**
- New to the codebase (learning curve for team)
- App Router is more complex than Pages Router
- Builder canvas is entirely client-side anyway — server components provide no benefit there
- Opinionated about data fetching patterns

### Option B: React SPA with Vite

**Pros:**
- Consistent with existing projects (Stellaris, hotel-de-ville)
- Simpler mental model — everything is client-side
- Faster dev server startup and HMR
- No server/client component boundary confusion

**Cons:**
- No SSR — marketplace pages have poor SEO
- Would need a separate SSR solution (or accept poor discoverability)
- No server-side data fetching — all API calls from client
- Would need separate routing for public vs. authenticated pages

### Option C: Remix

**Pros:**
- Excellent data loading patterns (loaders/actions)
- Good SSR story
- Progressive enhancement philosophy

**Cons:**
- Smaller ecosystem than Next.js
- Less Vercel integration (though supported)
- Team has zero Remix experience
- Community momentum has shifted toward Next.js App Router

---

## Consequences

### Positive

1. **Single framework for all three surfaces** — builder, platform, and marketplace share layouts, auth, and routing
2. **SEO for marketplace** — SSR/SSG pages are crawlable without additional infrastructure
3. **Reduced client bundle** — server components handle data fetching for plugin listings, ratings, user profiles
4. **Vercel-native deployment** — zero-config, preview deployments per PR, edge functions
5. **Future: real-time collaboration** — Next.js middleware can handle WebSocket upgrade routing

### Negative

1. **Learning curve** — team must learn App Router patterns (server vs. client components, server actions)
2. **Builder is purely client-side** — the most complex surface gets no benefit from server components; it will be a large `'use client'` subtree
3. **Vendor coupling** — Next.js is tightly coupled to Vercel (mitigated: can self-host if needed)

### Trade-off

The builder (the hardest engineering problem) gains nothing from Next.js server features. But the marketplace and platform surfaces (the growth surfaces) gain significantly. The alternative — building the builder as a Vite SPA and the marketplace as a separate Next.js app — creates two separate frontends with duplicated auth, routing, and design system. One framework for all three surfaces is worth the trade-off.

---

## Implementation Notes

- Builder pages: `app/builder/` — entirely `'use client'`, heavy canvas rendering
- Platform pages: `app/dashboard/`, `app/plugins/[id]/` — mixed server/client
- Marketplace pages: `app/marketplace/` — SSR-first with server components
- Shared: `app/layout.tsx` — auth provider, design system, navigation

---

## Related ADRs

- ADR-002: Backend Architecture
- ADR-007: Visual Builder Engine
- ADR-008: Deployment
