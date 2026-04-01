# ADR-003: Database — PostgreSQL via Neon

**Status:** Accepted
**Date:** 2026-03-28
**Decision Makers:** Solutions Architect (Claude)

---

## Institutional Memory Check

Related ADRs:
- Stellaris: Uses SQLite. Chosen for single-user mobile app simplicity.
- ADR-2026-001 (Dual-Database): Chose SQLite for canonical record store (shadow system) + Qdrant for vectors. Rationale: single-user, single-server, no concurrent writes.
- FRIDAY architecture: Qdrant for vectors, SQLite for admin (hotel-de-ville).

Consistency Analysis:
- Existing projects uniformly use SQLite because they are single-user or single-server. Bot the Builder is a multi-user SaaS product with concurrent writes, multiple serverless function instances, and transactional requirements (payments). SQLite is inappropriate here.

Divergence Justification:
- Multi-user SaaS with concurrent access from serverless functions requires a client-server database. SQLite's single-writer lock would cause contention under load. This is the textbook case for PostgreSQL.

---

## Context

Bot the Builder needs persistent storage for:

| Data | Access Pattern | Consistency Requirement |
|------|---------------|------------------------|
| User accounts + profiles | Read-heavy, auth on every request | Strong |
| Plugin metadata | Read-heavy (marketplace browsing) | Eventual OK |
| Plugin versions | Write on publish, read on install | Strong (must not serve partial versions) |
| Marketplace ratings/reviews | Write on submit, read-heavy | Eventual OK |
| Usage analytics | Write-heavy (telemetry) | Eventual OK |
| Payment records | Write on transaction, audit reads | Strong (financial) |
| Build configurations | Write on save, read on build | Strong |

The serverless deployment model (Vercel Functions) means multiple function instances may write concurrently. Connection pooling is required.

---

## Decision

Use **PostgreSQL via Neon** (serverless Postgres), accessed through **Drizzle ORM** from TypeScript and **SQLAlchemy** (async) from the Python service.

---

## Options Considered

### Option A: PostgreSQL via Neon — SELECTED

**Pros:**
- True multi-tenant relational database with ACID transactions
- Neon provides serverless scaling (auto-suspend, branching for previews)
- Native Vercel Marketplace integration (auto-provisioned, env vars injected)
- Connection pooling built in (essential for serverless)
- Branching: each PR preview deployment can get its own database branch
- Free tier generous enough for MVP (0.5 GiB storage, 190 compute hours)
- Full PostgreSQL compatibility — no proprietary SQL

**Cons:**
- New dependency (team has used SQLite exclusively)
- Cold start on auto-suspend (~500ms first query after idle)
- Cost at scale ($19/month for Pro, usage-based beyond)
- Vendor coupling to Neon (mitigated: standard Postgres, can migrate to any Postgres host)

### Option B: SQLite (Turso/libSQL)

**Pros:**
- Consistent with existing projects
- Turso provides multi-region edge replication
- Simple — no connection pooling concerns

**Cons:**
- Single-writer limitation causes contention under concurrent serverless writes
- Turso's replication model adds complexity for strong consistency
- Less mature ecosystem for serverless deployment
- No native Vercel Marketplace integration

### Option C: MongoDB (Atlas)

**Pros:**
- Flexible schema for plugin configurations (JSON-heavy)
- Atlas provides serverless deployment
- Good for document-shaped data

**Cons:**
- No relational integrity for user-plugin-version-payment relationships
- Team has no MongoDB experience
- Aggregation pipeline complexity for marketplace queries (top-rated, trending)
- Eventual consistency by default — problematic for payments

### Option D: PlanetScale (MySQL)

**Pros:**
- Serverless MySQL with branching
- Good Vercel integration

**Cons:**
- MySQL, not PostgreSQL (team preference for Postgres)
- Foreign key constraints disabled by default (Vitess limitation)
- PlanetScale shut down free tier in 2024

---

## Consequences

### Positive

1. **Correct tool for multi-user SaaS** — ACID transactions, concurrent writes, relational integrity
2. **Vercel-native** — Neon is a first-class Vercel Marketplace integration, auto-provisioned
3. **Preview branches** — each PR gets its own database branch with seeded data
4. **Connection pooling** — Neon's built-in pooler handles serverless connection patterns
5. **Migration path** — standard PostgreSQL, can move to any managed Postgres if needed

### Negative

1. **New technology for team** — first PostgreSQL project (though SQL knowledge transfers from SQLite)
2. **Cold start penalty** — ~500ms on first query after auto-suspend (only affects low-traffic periods)
3. **Cost** — more expensive than SQLite ($0 vs $19+/month at scale)

### Trade-off

SQLite is free and familiar, but fundamentally wrong for a multi-user serverless SaaS. The cold start penalty and learning curve are acceptable costs for correct concurrent access patterns. If the product fails, we wasted $0 (free tier). If it succeeds, SQLite would have been the first thing we replaced.

---

## Implementation Notes

### ORM: Drizzle

Drizzle ORM for the TypeScript layer. Chosen over Prisma for:
- SQL-like syntax (team already thinks in SQL from SQLite work)
- Better serverless performance (no binary engine)
- TypeScript-first with inferred types from schema
- Lighter bundle size

### Schema Design (Key Tables)

```sql
-- Users (from auth provider, see ADR-005)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id TEXT UNIQUE NOT NULL,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plugins
CREATE TABLE plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  github_repo TEXT,
  is_public BOOLEAN DEFAULT false,
  is_paid BOOLEAN DEFAULT false,
  price_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plugin versions
CREATE TABLE plugin_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID REFERENCES plugins(id),
  version TEXT NOT NULL,
  config JSONB NOT NULL,          -- The builder configuration
  claude_package JSONB,           -- Generated .claude/ structure
  changelog TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, version)
);

-- Marketplace
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID REFERENCES plugins(id),
  user_id UUID REFERENCES users(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, user_id)
);
```

### Python Service Access

The Python FastAPI service connects to the same Neon database via `DATABASE_URL` environment variable, using `asyncpg` + SQLAlchemy async. Read-only for most operations (LLM context loading). Writes only for AI-generated improvement suggestions.

---

## Related ADRs

- ADR-002: Backend Architecture
- ADR-005: Authentication
- ADR-006: Payment Processing
