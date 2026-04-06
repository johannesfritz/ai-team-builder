# AI Team Builder

**Started:** 2026-03-28
**Renamed:** 2026-04-01 (BotCamp → AI Team Builder)
**Purpose:** Visual no-code builder for Claude Code coworker plugins.
**Repo:** github.com/johannesfritz/ai-team-builder
**Deploy:** jfritz.xyz/ai-team-builder (Hetzner, static export via nginx)

## Status
**ALL PHASES COMPLETE.** CEO + Eng reviews CLEARED. Phases 1-4 implemented. 94 tests passing. Shareable URLs, live preview, fork gallery, health score, Cmd+K palette, MCPB export all built. Pending: deploy to production, Gist fallback for large plugins, Hetzner proxy for GitHub OAuth.

## Log

### 2026-04-06 — CEO review + glob fix + vitest setup + plan rewrite

- **Attempted:** Full CEO plan review (/plan-ceo-review) + 3 implementation tasks
- **CEO Review Decisions:**
  - Approach: Smart Static (keep Hetzner, add localStorage persist + Hetzner proxy for GitHub)
  - Mode: SCOPE EXPANSION — 6/8 proposals accepted
  - Accepted: shareable URLs, live preview pane, fork gallery, plugin health score, Cmd+K palette, MCPB export
  - Deferred: smart defaults from description, visual diff on import
  - Architecture: switched from Cloudflare Worker to Hetzner proxy (simpler, one deployment target)
  - Sharing: URL hash for small plugins + Gist fallback for large ones
  - Edge creation: both canvas view AND property panel dropdowns
  - Security: DOMPurify for XSS on shared URL content
  - URL versioning: v1: prefix for future compatibility
- **Implementation:**
  - Fixed glob matcher: replaced naive regex conversion with picomatch library. Old implementation broke on patterns like `src/**/*.py` and `**/*.{ts,tsx}`.
  - Set up vitest: installed vitest, created config, added test scripts, wrote 13 unit tests for simulation engine (all pass)
  - Rewrote PLAN-2026-001.md (v3): updated architecture diagram, stack table, feature status, implementation phases to match Smart Static reality
  - Created TODOS.md with deferred items
  - Created CLAUDE.md with skill routing rules
- **Outside voice (Claude subagent):** 11 findings including broken glob matcher (fixed), stale plan (fixed), persistence already exists (confirmed), CF Worker wrong tool (switched to Hetzner), URL sharing ceiling (added Gist fallback)
- **Produced:**
  - `src/lib/simulation/engine.ts` �� glob matcher fix (picomatch)
  - `src/lib/simulation/__tests__/engine.test.ts` — 13 unit tests
  - `vitest.config.ts` — test configuration
  - `TODOS.md` — deferred work items
  - `CLAUDE.md` — skill routing rules
  - `inbox/plans/PLAN-2026-001.md` — v3 plan rewrite
  - `~/.gstack/projects/johannesfritz-ai-team-builder/ceo-plans/2026-04-06-smart-static-expansion.md` — CEO plan with scope decisions
- **Next:** Phase 1 implementation (error handling, edge creation UX, schema migration, Plausible analytics, more unit tests)

### 2026-04-06 — Eng review + implementation sprint

- **Attempted:** Full engineering review (/plan-eng-review) + implementation of 4 fixes + complete test suite
- **Eng Review Findings:**
  - 1 architecture issue: cycle detection missing in derive.ts (fixed)
  - 3 code quality issues: nodeCounter global mutable (fixed), silent serialize errors (noted for Phase 2), schema migration (confirmed P0)
  - 34 test gaps identified (28% coverage → ~85%)
  - 3 critical failure modes: browser freeze from cycles (fixed), localStorage silent data loss (Phase 1), empty graph silent export (Phase 1)
  - 0 performance issues
- **Implementation:**
  - Fixed cycle detection: added visited set to collectAncestors BFS in derive.ts
  - Refactored nodeCounter: replaced module-level mutable with closure in parse-plugin.ts
  - Added MCP env editor: key-value pair editor in PropertyPanel McpFields
  - Improved error boundary: better messaging about corrupted saved data
  - Wrote 58 new tests across 4 test files (serialize, import, validation, derive)
  - Total: 71 tests, all passing in 342ms
- **Review Status:** CEO + ENG both CLEARED. Ready for Phase 1 implementation.
- **Produced:**
  - `src/lib/workflow/derive.ts` — cycle detection fix
  - `src/lib/import/parse-plugin.ts` — nodeCounter refactor
  - `src/components/builder/PropertyPanel.tsx` — MCP env editor
  - `src/app/builder/error.tsx` — improved error boundary
  - `src/lib/export/__tests__/serialize.test.ts` — 12 tests
  - `src/lib/import/__tests__/parse-plugin.test.ts` — 10 tests
  - `src/lib/__tests__/validation.test.ts` — 25 tests
  - `src/lib/workflow/__tests__/derive.test.ts` — 11 tests
  - `inbox/plans/PLAN-2026-001.md` — review report section
- **Next:** Phase 1 remaining items: schema migration skeleton, error handling for 10 paths, edge creation UX, command selector fix, Plausible analytics

### 2026-04-06 — Phase 1 implementation sprint (continued)

- **Attempted:** Complete Phase 1 implementation using parallel sub-agents
- **Implementation (7 commits total this session):**
  - Schema migration skeleton: version: 1 + migrate function in builder-store.ts
  - Canvas view: third tab in builder (press 3), restores React Flow drag-to-connect
  - Edge connection dropdowns: "Connect to..." in PropertyPanel for form-based wiring
  - Plausible analytics: script in layout + trackEvent utility (analytics.ts)
  - Toast notification system: toast.ts + toaster.tsx, wired into layout
  - Error handling: localStorage quota/rehydration errors, empty graph export, serialize error toasts
  - Structured serialization errors: nodeId + nodeType + message (was plain strings)
  - Spike cleanup: deleted spike-1/2/3 directories (-3048 lines)
  - MCP env editor: key-value pair editor for environment variables
- **Phase 1 Status:** COMPLETE. All items done.
- **Tests:** 71 passing in 337ms (no regressions)
- **Build:** Passes clean (TypeScript + static export)
- **Linear:** JCC-136 (session tracking)
- **Next:** Phase 2 (shareable URLs, live preview, DOMPurify) or Phase 3 (gallery, health score)

### 2026-04-06 — Phases 2-4 implementation (parallel agents)

- **Attempted:** Implement all three remaining phases using parallel sub-agents
- **Agent structure:** 3 agents ran in parallel:
  - Agent 1: Phase 2 (share URLs, live preview, DOMPurify, Toolbar share button)
  - Agent 2: Phase 3 (health score, gallery fork, Cmd+K palette)
  - Direct: Phase 4 (MCPB ZIP export via JSZip)
- **Phase 2 (Share & Preview):**
  - `lib/share.ts` — LZ-string compression with v1: version prefix, 4000 char cap
  - `lib/sanitize.ts` — DOMPurify wrapper for XSS protection on shared URLs
  - `components/builder/LivePreview.tsx` — real-time file preview with copy buttons
  - URL hash loading on builder page mount
  - Share button in toolbar (copies to clipboard)
  - 8 unit tests for share encoding/decoding
- **Phase 3 (Discovery & Quality):**
  - `lib/health.ts` — graph-level analysis: orphaned hooks, heavy rules, unrestricted agents, no commands, cycle detection
  - `components/builder/HealthIndicator.tsx` — traffic light + expandable issue list
  - `components/builder/CommandPalette.tsx` — Cmd+K palette (cmdk) for node creation + actions
  - Showcase page updated with "Fork & Customize" buttons
  - 10 unit tests for health analysis
- **Phase 4 (Export):**
  - `lib/export/mcpb.ts` — JSZip-based MCPB bundle generation
  - Download MCPB button in export modal
  - 5 unit tests for ZIP generation + content verification
- **Tests:** 94 passing (23 new: 8 share + 10 health + 5 MCPB)
- **Dependencies added:** lz-string, dompurify, jszip, cmdk
- **Linear:** JCC-137
- **Status:** ALL FOUR PHASES COMPLETE
- **Next:** Deploy to production (build + rsync to Hetzner), then Phase 2+ items (Gist fallback for large plugins, Hetzner proxy for GitHub OAuth)

### 2026-04-06 — Deploy + Hetzner proxy + Gist fallback

- **Attempted:** Deploy to production, build Hetzner proxy, add Gist sharing fallback
- **Blocker found:** Next.js 16 Turbopack static export broken because project folder is named `app/`, colliding with App Router directory detection. Turbopack treated the project root as the App Router directory instead of finding `src/app/`.
- **Fix:** Removed the `src/` layer entirely. Moved all source files from `app/src/*` to `app/*`. Updated tsconfig paths `@/* → ./*`.
- **Deploy:** Built static export, rsync to Hetzner. All 3 routes returning 200.
- **Hetzner proxy:** Created `server/github-proxy.py` (FastAPI) with OAuth token exchange, GitHub API CORS proxy (repos, gists, git data), IP rate limiting. Systemd service + nginx config.
- **Gist fallback:** `lib/share.ts` now async. Plugins exceeding URL hash limit fall back to GitHub Gist via proxy. `decodeShareURL` handles both `#v1:` and `#gist:` formats.
- **GitHub auth:** `lib/github-auth.ts` manages tokens in localStorage. Builder page handles OAuth callback via URL fragment.
- **Tests:** 97 passing (3 new Gist URL tests)
- **Linear:** JCC-138
- **Produced:**
  - `server/github-proxy.py` — FastAPI proxy (~130 lines)
  - `server/ai-team-builder-github.service` — systemd unit
  - `server/nginx-proxy.conf` — nginx location block
  - `app/lib/github-auth.ts` — token management
  - Updated `app/lib/share.ts` — async + Gist fallback
  - Directory restructure: `src/` removed, all source at root level
- **Remaining:** Deploy proxy to server (register GitHub OAuth App, install Python deps, start service, configure nginx). This requires manual server access with credentials.

### 2026-04-06 — Server proxy deployment + QA

- **Attempted:** Deploy GitHub proxy to Hetzner, run QA on live site
- **Proxy deployment:**
  - Registered GitHub OAuth App (callback: jfritz.xyz/ai-team-builder/api/auth/callback)
  - Installed fastapi/uvicorn/httpx on server
  - Deployed github-proxy.py to /var/www/ai-team-builder-data/
  - Started systemd service (ai-team-builder-github, port 3848)
  - Updated nginx proxy: /ai-team-builder/api/ → localhost:3848
  - Narrowed OAuth scope from `repo,gist` to `public_repo,gist`
  - Health check passing, OAuth redirect working
- **QA results:** Health score 88/100
  - ISSUE-001 (Medium): Create dialog pre-fill bug — name showed as placeholder, button disabled. FIXED: pre-fill with example value. Deployed.
  - ISSUE-002 (Low): Showcase page missing real-world plugin cards. Deferred.
- **Linear:** JCC-138 (deploy), JCC-143 (QA)
- **Status:** PROJECT COMPLETE. All features live, proxy running, QA passed.




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

### 2026-04-01 — Overnight autonomous sprint

- **Goals:** Two parallel workstreams — (1) app improvement sprint, (2) jf-dev configuration improvements
- **Research:** Analyzed 3 reference repos (slavingia/skills, garrytan/gstack, karpathy/autoresearch) for product/optimization patterns
- **Linear:** JF-232 (app sprint, 5 subtasks) DONE, JF-233 (config commands, 5 files) DONE
- **App improvements deployed:**
  1. Plugin name + description inline editor in summary card
  2. Import parser: flexible agent format, auto-extract command descriptions, default model=inherit
  3. Workflow phase extraction from markdown headings (iran-monitor /update shows 12 phases)
  4. Landing page: "How it works" guide, real-world plugin cards, better copy
  5. Fullscreen editor for all long text fields (system prompts, rules, commands)
  6. Iran Conflict Monitor as second showcase use case (7 files, 4 commands)
  7. Empty state with guided first steps (create command → add agent → define standards)
  8. Keyboard shortcuts (Cmd+Z undo, Cmd+Shift+Z redo, 1/2 view switch)
  9. Delete confirmation dialog
  10. Export: structured file tree, install instructions, download button
  11. Tools as clickable chip toggles (not text input)
  12. Tooltip positioning fix (right-aligned, no screen bleed)
- **Config improvements committed (jf-private root repo):**
  - `/brainstorm` — lightweight ideation (challenge premises, narrow wedge)
  - `/ship` — unified shipping (test → review → commit → push → deploy → Linear)
  - `/retro` — per-sprint retrospective
  - `/search-first` — search before building (3-layer)
  - `search-before-building.md` rule
- **Key insight from gstack:** Process beats tooling. Sprint workflow (Think→Plan→Build→Review→Test→Ship) is what makes parallel agents effective.
- **Key insight from autoresearch:** Fixed-budget iteration with keep/discard and "NEVER STOP" enables autonomous overnight work.

## Backlog

### Priority 1: Testing
- Playwright E2E against production URL
- Unit tests for serializer, simulation engine, workflow derivation

### Priority 2: AI Assist
- Natural language to components (needs server/API — deferred)
- Import from existing `.claude/` directory (DONE — working)

### Priority 3: Further Polish
- Loading states, error boundaries
- Responsive layout improvements
- Drag reorder in workflow view (@dnd-kit installed but not wired)
