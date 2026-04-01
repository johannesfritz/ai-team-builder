# ADR-005: Authentication — GitHub OAuth via NextAuth.js

**Status:** Accepted
**Date:** 2026-03-28
**Decision Makers:** Solutions Architect (Claude)

---

## Institutional Memory Check

Related ADRs: None. Existing projects (Stellaris) have no authentication — they are single-user apps. This is the first multi-user auth decision.

Consistency Analysis:
- No prior auth pattern to be consistent with. This establishes the pattern for Bot the Builder.

---

## Context

Bot the Builder users need:

1. **GitHub identity** — required for plugin distribution (ADR-004). Users must authenticate with GitHub to push plugins to repos.
2. **Session management** — authenticated access to builder, dashboard, marketplace purchases.
3. **Role-based access** — plugin owner, buyer, anonymous marketplace browser.

The critical constraint: GitHub OAuth is not optional. Users need GitHub accounts for plugin distribution. The auth provider MUST support GitHub OAuth. The question is whether to use a managed service (Clerk, Auth0) or a self-managed solution.

---

## Decision

Use **NextAuth.js (Auth.js v5)** with **GitHub as the sole OAuth provider**, storing sessions in the PostgreSQL database (Neon) via the Drizzle adapter.

---

## Options Considered

### Option A: NextAuth.js with GitHub OAuth — SELECTED

**Pros:**
- Open source, no per-user pricing
- First-class Next.js integration (App Router compatible)
- Drizzle adapter stores sessions in our existing PostgreSQL database
- GitHub OAuth scopes give us the permissions needed for the GitHub App (ADR-004)
- Full control over session handling, token refresh, user data
- One fewer vendor dependency

**Cons:**
- Must manage session security ourselves (mitigated: NextAuth.js handles this well)
- No built-in UI components (login page, profile management)
- Must implement password reset, email verification if we add email/password later (not needed for MVP)

### Option B: Clerk

**Pros:**
- Beautiful pre-built UI components (sign-in, sign-up, profile)
- Managed session security
- Multi-factor auth out of the box
- Native Vercel Marketplace integration

**Cons:**
- $0.02/MAU after 10,000 — cost scales linearly with users
- Vendor lock-in on auth (hardest thing to migrate away from)
- Still need separate GitHub OAuth for repo access (Clerk handles identity, not API tokens)
- Over-engineered for a single-provider OAuth flow

### Option C: Auth0

**Pros:**
- Enterprise-grade, battle-tested
- Supports every OAuth provider
- Extensive documentation

**Cons:**
- Complex for a single-provider setup
- $23/month for basic plan (7,500 MAU)
- Heavy SDK, configuration overhead
- Like Clerk, does not provide GitHub API tokens — separate OAuth flow still needed

### Option D: Custom OAuth implementation

**Rejected** — no reason to implement OAuth from scratch when NextAuth.js exists. Security risks outweigh any benefit.

---

## Consequences

### Positive

1. **Zero per-user cost** — no SaaS auth billing, scales to any user count
2. **Single auth flow** — GitHub OAuth provides both identity AND the API tokens needed for repo operations
3. **Data ownership** — all user/session data in our PostgreSQL database
4. **Simplicity** — one OAuth provider, one session store, one auth library
5. **Extensible** — can add Google/email providers later via NextAuth.js config

### Negative

1. **No pre-built UI** — must build login page, profile page (minimal effort with shadcn/ui)
2. **GitHub-only** — users without GitHub accounts cannot use the platform (acceptable: they need GitHub for Claude plugins anyway)
3. **Security responsibility** — we manage CSRF, token rotation, session expiry (mitigated: NextAuth.js handles these correctly by default)

### Trade-off

Clerk would save 2-3 days of UI work (pre-built components) but costs money at scale and still requires a separate GitHub OAuth flow for API tokens. NextAuth.js is free, gives us the GitHub tokens we need for repo operations, and stores everything in our existing database. The UI work is minimal — a login button and a profile dropdown.

---

## Implementation Notes

### Auth Flow

```
User clicks "Sign in with GitHub"
  → NextAuth.js redirects to GitHub OAuth
  → GitHub returns auth code
  → NextAuth.js exchanges for access token + refresh token
  → Stores user record in PostgreSQL (users table)
  → Creates session (JWT or database session)
  → Redirects to dashboard

GitHub OAuth scopes requested:
  - read:user (profile info)
  - user:email (email address)
  - repo (create/push to repos — for plugin publishing)
```

### Session Strategy

Use **database sessions** (not JWT) for:
- Revocability (can invalidate sessions on password change or suspicious activity)
- Token storage (GitHub access tokens stored server-side, never exposed to client)
- Simpler than managing JWT rotation

### Middleware

```typescript
// middleware.ts
export { auth as middleware } from "@/auth"

export const config = {
  matcher: ["/dashboard/:path*", "/builder/:path*", "/api/plugins/:path*"]
}
```

Public routes (marketplace, landing page) do not require auth. Builder and dashboard routes require auth via middleware.

---

## Related ADRs

- ADR-003: Database (session/user storage)
- ADR-004: Plugin Storage & Distribution (GitHub tokens from OAuth)
