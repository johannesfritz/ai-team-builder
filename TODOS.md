# TODOS

## P2: Clean up dead backend imports
- **What:** auth.ts, db/schema.ts, db/index.ts import next-auth, drizzle-orm, @neondatabase/serverless. These add to bundle but never execute in static export mode.
- **Why:** Bundle bloat + confusion for new contributors.
- **Effort:** S (CC: ~10 min)
- **Context:** Files kept as reference for potential future Approach B (full-stack). Remove imports, add comment "// Dormant: kept for future backend integration."

## Deferred: Smart defaults from description
- **What:** Pattern-matching starter nodes from one-line description (e.g., "review tool" → hook + rule + command).
- **Why:** Templates + fork gallery already solve cold-start problem.
- **Effort:** S (CC: ~15 min)
- **Context:** Accepted scope includes gallery with fork. This is incremental on top.

## Deferred: Visual diff on import
- **What:** Side-by-side diff showing what import would change vs current canvas state.
- **Why:** Useful when round-tripping (export → manual edit → re-import). Not critical for v1.
- **Effort:** M (CC: ~30 min)
- **Context:** Import currently replaces canvas entirely.
