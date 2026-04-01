# AI Team Builder

**Started:** 2026-03-28
**Renamed:** 2026-04-01 (BotCamp → AI Team Builder)
**Purpose:** Visual no-code builder for Claude Code coworker plugins.
**Repo:** github.com/johannesfritz/ai-team-builder
**Deploy:** jfritz.xyz/ai-team-builder (Hetzner, static export via nginx)

## Status
**LIVE at https://jfritz.xyz/ai-team-builder/**. Major UX overhaul deployed: Team Setup panel view replaces canvas, validation engine, guidance system. Workflow tab preserves React Flow canvas. cc-data-science-team integrated as showcase. Remaining: WS-C (Workflow timeline), WS-D (help tooltips), guided creation dialogs, E2E tests.

## Log

### 2026-03-28 — Full product discovery

- **Attempted:** Complete discovery flow: PM validation, UX research, solutions architecture (9 ADRs), technical PM specification, UAT protocol design
- **Produced:**
  - `docs/adr/README.md` + 9 ADR files (architecture decisions)
  - `docs/uat-protocol-mvp.md` (complete UAT protocol with 5 journeys, 22 acceptance criteria, 40+ edge cases)
  - `inbox/plans/PLAN-2026-001.md` (development plan)
  - `documentation/process-log.md` (this file)
- **Learned:**
  - ICE score is low (8.4/100) due to platform risk and unvalidated market
  - No competition exists for Claude Code plugin builders — wide open gap
  - PM recommends staged validation (Stage 0: publish & measure, Stage 1: CLI scaffolder) before web builder
  - Architecture: Next.js + React Flow + Neon Postgres + Python sidecar on Vercel Services
  - 3 technical spikes needed before building: React Flow graph model, GitHub OAuth+repo creation, Vercel Services reliability
  - Estimated effort: 17.5 person-days (~3.5 person-weeks) for Stage 2
  - Monthly cost: ~$100
- **Next:** CEO decides staging strategy. If Stage 0, publish Configuration Handbook and existing plugins publicly. If Stage 2, execute spikes first (2 days).

### 2026-03-28 — Plan v2: Builder-first scope

- **Attempted:** Synthesized original discovery (PM, UX, Architecture, Technical PM, UAT) with external feasibility study covering MCP ecosystem, competitive landscape, infrastructure economics, and payment models
- **Produced:**
  - Updated `inbox/plans/PLAN-2026-001.md` — v2 focused on builder only, marketplace deferred
  - Reduced scope from 17.5 to 15 person-days by removing marketplace workstream
  - Added MCPB bundle export (from feasibility study — one-click install format)
  - Added Import from existing `.claude/` directory feature
  - Reduced monthly cost from ~$100 to ~$56 (no React Flow Pro needed)
- **Learned:**
  - MCP ecosystem has 97M monthly SDK downloads, 10K+ active servers — broader momentum than our PM assumed
  - MCPB bundles are the preferred distribution format (ZIP with manifest, one-click install)
  - Dify.ai is the most credible future threat (5M+ downloads, has a plugin marketplace, native MCP)
  - Hetzner is 10-20x cheaper than Vercel for hosting at scale — keep as future migration option
  - gVisor sandboxing needed if we ever host user-created plugins (future phase)
- **Next:** Execute SPIKE-1 (React Flow plugin graph model) — this is the go/no-go decision gate

### 2026-04-01 — SPIKE-1 Complete: React Flow — GO

- **Attempted:** Built throwaway React Flow prototype with 5 custom node types, edge validation, and graph-to-plugin serialization
- **Produced:**
  - `spike-1-reactflow/` — Working prototype with canvas, toolbar, export preview
  - `spike-1-reactflow/SPIKE-REPORT.md` — Full spike report with findings
  - Screenshots: `spike-1-canvas.png`, `spike-1-export.png`
- **Learned:**
  - React Flow v12 handles all 4 spike questions: custom nodes, edge validation, serialization, performance
  - Auto-generated hook actions from edge connections is a UX win (users draw edges, not write shell commands)
  - `isValidConnection` type is `Edge | Connection` (union), not just `Connection`
  - 11/11 edge validation tests pass
  - Bundle: 378KB JS (119KB gzipped) — acceptable
  - MIT license, free for commercial use
- **Verdict:** GO — proceed to WS0 scaffolding
- **Next:** Execute SPIKE-2 (GitHub OAuth + repo creation) and SPIKE-3 (Vercel Services) in parallel, then begin WS0

### 2026-04-01 — SPIKE-2 + SPIKE-3 Complete: Both GO

- **Attempted:** Research spikes for GitHub OAuth and Vercel Services (ran in parallel)
- **Produced:**
  - `spike-2-github-oauth/SPIKE-REPORT.md` — Auth.js v5 + GitHub OAuth + repo creation
  - `spike-2-github-oauth/example-auth-config.ts` — Auth config + repo creation code
  - `spike-3-vercel-services/SPIKE-REPORT.md` — Vercel Services Python sidecar
  - `spike-3-vercel-services/example-vercel-config.ts` — Dual-service config
  - `spike-3-vercel-services/example-api.py` — FastAPI app with Claude API
- **SPIKE-2 Learned:**
  - Auth.js v5 does NOT expose GitHub token by default — need custom jwt+session callbacks
  - Minimum scope: `public_repo` (not `repo`) to avoid over-permissioning
  - Use Git Data API (create tree → commit → update ref) for atomic multi-file push (6 API calls)
  - GitHub OAuth tokens don't expire — no refresh logic needed
  - Duplicate repo names return 422; handle with rename or push-to-existing
- **SPIKE-3 Learned:**
  - Vercel Services is beta but production-ready for this use case
  - No CORS issues — both services on same domain
  - Cold starts 500ms-2s, negligible vs Claude API latency
  - `anthropic` SDK installs fine (well under 500MB limit)
  - FastAPI routes must NOT include route prefix (Vercel strips it)
  - Streaming responses work (ASGI)
- **Verdict:** All 3 spikes GO — no blockers for WS0
- **Next:** Begin WS0 (project scaffolding)

### 2026-04-01 — WS0 + WS1 + WS2 (partial): Scaffold + Schema + Builder Canvas

- **Attempted:** Combined WS0 (scaffolding), WS1 (database schema), and WS2 (visual builder) into one session
- **Produced:**
  - `app/` — Next.js 16 project with TypeScript, Tailwind, shadcn/ui (12 components), dark mode, Geist fonts
  - `src/auth.ts` — Auth.js v5 with GitHub OAuth, custom callbacks for token exposure
  - `src/db/schema.ts` — Drizzle schema: users, accounts, sessions, plugins, plugin_versions, templates
  - `src/db/index.ts` + `drizzle.config.ts` — Neon Postgres connection
  - `src/lib/plugin-types.ts` — Plugin node types, valid connections, colors
  - `src/lib/export/serialize.ts` — Graph → `.claude-plugin/` serialization (production version)
  - `src/stores/builder-store.ts` — Zustand store with undo/redo, node CRUD, edge validation
  - `src/components/builder/nodes/` — 6 custom React Flow nodes (Rule, Hook, Skill, Command, Agent, MCP)
  - `src/components/builder/Canvas.tsx` — React Flow canvas with dark theme
  - `src/components/builder/Toolbar.tsx` — Component palette + export button
  - `src/components/builder/PropertyPanel.tsx` — Context-sensitive property editor (6 node type forms)
  - `src/app/builder/[id]/page.tsx` — Builder page (3-panel layout)
  - `src/app/page.tsx` — Landing page
  - Screenshots: `botcamp-landing.png`, `botcamp-builder.png`
- **Learned:**
  - Next.js 16 + shadcn v4: `asChild` prop removed, use wrapping instead
  - Auth.js v5 beta: JWT module augmentation path changed; used type assertion workaround
  - React Flow renders perfectly in Next.js 16 App Router as client component
  - Build passes clean (TypeScript + Turbopack)
- **Status:** WS0 DONE, WS1 DONE (schema only, no migrations yet — needs DATABASE_URL), WS2 ~60% (canvas + nodes + property panel + serialization done; missing: dry run, import)
- **Next:** Complete WS2 (dry run simulation), then WS3 (GitHub export), WS4 (templates)

### 2026-04-01 — WS2 continued + WS3 partial: Dry Run + GitHub Export

- **Attempted:** Added dry run simulation engine, dry run UI, and GitHub export module
- **Produced:**
  - `src/lib/simulation/engine.ts` — Structural simulation engine (traces rules, hooks, skills, commands by event matching)
  - `src/components/builder/DryRun.tsx` — Dry run panel with prompt/tool/file inputs and step-by-step trace output
  - `src/lib/export/github.ts` — GitHub repo creation + atomic multi-file push via Git Data API
  - Updated `src/app/builder/[id]/page.tsx` — Properties/Dry Run tab switcher in right panel
  - Updated `src/components/builder/Toolbar.tsx` — Added Dry Run button
  - Screenshot: `botcamp-dryrun.png`
- **Learned:**
  - Simulation engine correctly traces: rules by path filter, hooks by tool matcher, commands as always-registered, skills by file pattern
  - Token estimation works (counts chars / 4)
  - High token warning triggers above 2000 tokens
  - Considered Vue/Nuxt switch (bos stack) — decided to stay with React. BotCamp is standalone, React Flow is proven, switching costs 1-1.5 days for zero functional gain.
- **Status:** WS2 ~85% (dry run done, import still missing), WS3 ~50% (GitHub API code written, needs UI integration), WS4-WS7 not started
- **Next:** Wire GitHub export into toolbar UI, add template gallery, then testing

### 2026-04-01 — Rename, templates, deploy LIVE

- **Attempted:** Renamed to AI Team Builder, added templates, configured static export, deployed to jfritz.xyz
- **Produced:**
  - Renamed project from BotCamp → AI Team Builder (all brand references updated)
  - `src/lib/templates.ts` — 5 starter templates (Code Review, Git Discipline, Agent Pipeline, Security Scanner, API Integration)
  - Landing page with template gallery (category badges, node counts)
  - Template loading via `?template=` URL parameter
  - `next.config.ts` — static export with `basePath: "/ai-team-builder"`
  - Nginx config on jfritz.xyz for `/ai-team-builder/` with `try_files $uri $uri.html`
  - Download JSON button in export modal
  - GitHub repo created: github.com/johannesfritz/ai-team-builder
  - Two commits pushed (initial + templates/deploy)
- **Deployed:** https://jfritz.xyz/ai-team-builder/ — LIVE and verified
- **Status:** WS0-WS4+WS6 DONE. Landing page, builder, dry run, templates, export all working in production.
- **Remaining:**
  - WS5: AI assist (natural language → components) + import from `.claude/`
  - WS7: Testing (Playwright E2E, unit tests)
  - Polish: loading states, error boundaries, responsive
- **Next:** WS7 testing against production URL, then WS5 AI assist

## Backlog

### Priority 1: Workflow View
- **Plan:** `documentation/workflow-view-plan.md`
- **Summary:** Second view in the builder showing sequential execution flow of slash commands. Vertical timeline with step cards, per-command switching, drag reorder, edit warnings (amend vs create copy), and new workflow creation.
- **Complexity:** Medium | **Effort:** 2-3 days | **Risk:** 4/10
- **Key decision:** Derive workflows from graph edges (no separate storage). Display order is cosmetic; execution order is runtime-determined.
- **Dependencies:** None beyond existing codebase. New dep: `@dnd-kit/core` + `@dnd-kit/sortable` (~15KB gzipped).
- **Status:** Plan written, awaiting CEO approval.

### Priority 2: WS5 — AI Assist
- Import from existing `.claude/` directory (partially scoped)
- Natural language to components (needs server/API — deferred)

### Priority 3: WS7 — Testing
- Playwright E2E against production URL
- Unit tests for serializer, simulation engine, workflow derivation

### Priority 4: Polish
- Loading states, error boundaries
- Responsive layout
- Keyboard navigation
