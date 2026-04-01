# SPIKE-1 Report: React Flow Plugin Graph Model

**Date:** 2026-04-01
**Duration:** <1 day
**Verdict:** GO — React Flow works for BotCamp

---

## Questions Answered

### 1. Can React Flow model Claude Code plugin relationships?

**YES.** 5 custom node types (Rule, Hook, Skill, Command, Agent) render correctly with:
- Color-coded badges and borders
- Inline data display (path filters, matchers, model names, tool lists)
- Source and target handles positioned for left-to-right flow
- Content truncation for long markdown

### 2. Can edges enforce valid relationships?

**YES.** `isValidConnection` on the `<ReactFlow>` component receives `Edge | Connection` and validates against a `VALID_CONNECTIONS` map. 11/11 test cases pass:

| Connection | Result |
|-----------|--------|
| hook → rule | Allowed |
| hook → skill | Allowed |
| agent → skill | Allowed |
| skill → command | Allowed |
| rule → rule | Blocked |
| rule → hook | Blocked |
| command → rule | Blocked |
| agent → rule | Blocked |
| agent → command | Blocked |
| skill → hook | Blocked |
| hook → agent | Blocked |

React Flow shows a visual "not allowed" indicator when dragging invalid connections.

### 3. Can the graph serialize to a valid `.claude-plugin/` directory?

**YES.** The `serializeGraph()` function converts React Flow nodes + edges to:

```
.claude-plugin/
  plugin.json              # Manifest
  rules/code-standards.md  # Rule with paths: frontmatter
  skills/run-tests/SKILL.md # Skill with description, filePattern, bashPattern
  agents/code-reviewer.md  # Agent with model, system prompt, tools
  commands/review.md       # Command prompt template
  hooks/hooks.json         # Hooks collected from HookNodes + edge targets
```

Key insight: **hooks auto-generate their `command` action from connected edges.** When a HookNode connects to a RuleNode, the serializer generates `cat "${CLAUDE_PLUGIN_ROOT}/rules/{name}.md"` automatically. This means users don't need to write shell commands — they just draw an edge.

### 4. How does React Flow handle 20+ nodes with custom forms?

**Acceptable.** The sample graph with 6 nodes and 4 edges renders instantly. The MiniMap tracks all nodes correctly. React Flow is known to handle 100+ nodes without performance issues. Custom forms inside nodes (not yet tested with full inline editing) are the potential bottleneck — but sidebar-based property editing avoids this entirely.

### 5. How large is the bundle?

378 KB JS (119 KB gzipped) including React, React DOM, React Flow, and Zustand. Acceptable for a builder tool.

---

## Technical Findings

### API Surface (React Flow v12, @xyflow/react)

| API | Purpose | Works? |
|-----|---------|--------|
| `useNodesState` / `useEdgesState` | State management with change handlers | Yes |
| `isValidConnection` prop on `<ReactFlow>` | Edge validation | Yes |
| `toObject()` from `useReactFlow()` | Serialize to JSON (nodes + edges + viewport) | Yes |
| `setNodes` / `setEdges` / `setViewport` | Restore from JSON | Yes (API confirmed) |
| Custom node types via `nodeTypes` | Register custom components | Yes |
| `<Handle>` with `type` and `position` | Connection points on nodes | Yes |
| `<MiniMap>` with `nodeColor` | Color-coded minimap | Yes |
| `<Background>` with variants | Canvas background | Yes |
| `<Controls>` | Zoom/fit controls | Yes |

### Type Issue Found

`isValidConnection` callback type is `(edge: Edge | Connection) => boolean`, not `(connection: Connection) => boolean`. The union type means the callback must handle both existing edges and new connections.

### CSS Import

`@xyflow/react/dist/style.css` needs a `// @ts-expect-error` for TypeScript without CSS module declarations. Not a problem in production (Vite handles it at runtime).

---

## Recommendation

**Proceed to WS0 (scaffolding).** React Flow is confirmed as the right choice for BotCamp's visual builder:

1. Custom nodes with inline data display work naturally
2. Edge validation enforces the plugin component relationship model
3. Serialization to `.claude-plugin/` is straightforward
4. The auto-generated hook actions from edge connections is a UX win — users draw relationships, not write shell commands
5. Bundle size is acceptable
6. MIT license, no cost

### For the real build, add:
- Sidebar property panel (forms for editing node data on selection)
- Zustand store for undo/redo
- Inline markdown editor for rule/skill content
- `screenToFlowPosition` for drag-and-drop from the toolbar

---

## Files

| File | Purpose |
|------|---------|
| `src/types.ts` | Plugin schema types + VALID_CONNECTIONS map |
| `src/nodes/*.tsx` | 5 custom node components |
| `src/serialize.ts` | Graph → .claude-plugin/ serialization |
| `src/App.tsx` | Main canvas with toolbar, edge validation, export |
| `spike-1-canvas.png` | Screenshot of rendered canvas |
| `spike-1-export.png` | Screenshot of export preview |
