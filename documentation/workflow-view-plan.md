# Workflow View — Implementation Plan

**Author:** Technical PM
**Date:** 2026-03-28
**Status:** Draft — awaiting CEO approval
**Complexity:** Medium (multi-component feature, no new infrastructure)
**Effort estimate:** 2-3 person-days

## Historical Context

Searched: No Qdrant available (QMD local search only). Reviewed existing codebase directly.
Past similar plans: None — this is the first feature addition beyond MVP.
Applied learnings: The simulation engine (`engine.ts`) already traces execution sequences from graphs. The workflow view can reuse its traversal logic rather than inventing a new graph walker.

---

## 1. Requirements Summary

Users need a second view in the builder — "Workflow View" — showing the sequential execution flow of a slash command. This complements the existing "Team Setup" canvas (spatial/graph view) with a temporal/sequential view.

**User value:** The canvas shows *what exists*. The workflow view shows *what happens when*. Users building complex plugins need both mental models.

### Must-have

1. Two-view toggle: "Team Setup" (existing canvas) and "Workflow" (new)
2. Per-command workflow: dropdown to select a command, view shows its execution chain
3. Click any element to inspect/edit (reuses PropertyPanel)
4. Drag to reorder elements in the sequence
5. Edit warning: "Amend existing (changes all uses)" vs "Create new under different name"
6. Create new workflow/command from this screen

### Nice-to-have (defer to v2)

- Animated playback of execution sequence
- Diff view between two workflows
- Workflow-level token budget estimation

---

## 2. Key Design Decision: Derive vs Store Workflows

**Decision: Derive workflows from the graph. Do not store separately.**

**Rationale:**

The graph already encodes execution relationships through edges:
- `command` nodes are entry points (slash commands)
- `skill → command` edges link skills to the commands that invoke them
- `agent → skill` edges link agents to their skills
- `hook → rule/skill` edges link hooks to what they inject

Storing workflows separately would create a sync problem: every graph edit would need to update the workflow, and vice versa. Derivation is simpler and eliminates consistency bugs.

**How derivation works:**

Given a selected Command node, walk backwards through edges:
1. Find all `skill` nodes with edges targeting this command
2. Find all `agent` nodes with edges targeting those skills
3. Find all `hook` nodes with edges targeting those skills/rules
4. Find all `rule` nodes (always-loaded, no path filter = global)
5. Order into execution sequence: rules first (session start) → hooks (tool events) → skills (invocation) → command (user action)

This mirrors the logic already in `simulation/engine.ts` (steps 1-4 of `simulate()`), so we can extract and reuse that traversal.

**Reordering constraint:** Drag-reorder in the workflow view is *cosmetic display order*, not structural. The actual execution order is determined by Claude Code's runtime (rules load first, hooks fire on events, commands fire on user invocation). The view shows the *conceptual* sequence, and users can rearrange to reflect their mental model, but this does not change the exported plugin. Display order is stored in component-local state or an optional `workflowOrder` metadata field, not in the graph edges.

---

## 3. UI Wireframe (Text-Based)

### Builder Page — Workflow View Active

```
+--[Toolbar 200px]--+---[Main Area]----------------------------+--[Right Panel 320px]--+
|                    |                                          |                       |
| AI Team Builder    | [Team Setup] [Workflow]  <- tab bar      | Properties | Dry Run  |
|                    |                                          |                       |
| Add Component      | Command: [/review    v]  <- dropdown     | (same PropertyPanel   |
|  + Rule            |                                          |  as canvas view)      |
|  + Hook            | +--------------------------------------+ |                       |
|  + Skill           | |  WORKFLOW: /review                   | |                       |
|  + Command         | |                                      | |                       |
|  + Agent           | |  1. [Rule] Code Standards        [i] | |                       |
|  + MCP             | |     Always loaded (no path filter)   | |                       |
|                    | |     ~120 tokens                      | |                       |
|  Undo | Redo       | |          |                            | |                       |
|  Import            | |          v                            | |                       |
|  Dry Run           | |  2. [Hook] Pre-Edit Check        [i] | |                       |
|  Export Plugin      | |     Fires on: Edit|Write (once)      | |                       |
|                    | |     Injects: rule:code-standards      | |                       |
|                    | |          |                            | |                       |
|                    | |          v                            | |                       |
|                    | |  3. [Skill] Codebase Analysis    [i] | |                       |
|                    | |     Agent: Researcher                | |                       |
|                    | |     ~200 tokens                      | |                       |
|                    | |          |                            | |                       |
|                    | |          v                            | |                       |
|                    | |  4. [Command] /review            [i] | |                       |
|                    | |     Entry point (user invocation)     | |                       |
|                    | |                                      | |                       |
|                    | |  [+ Add Step]                        | |                       |
|                    | +--------------------------------------+ |                       |
|                    |                                          |                       |
|  3 nodes | 2 edges | Total: ~420 tokens                      |                       |
+--------------------+------------------------------------------+-----------------------+
```

### Visual Design

- **Vertical timeline** (top to bottom), not horizontal. Matches reading order and works better on narrow screens.
- Each step is a **card** with: type badge (colored), name, one-line description, token estimate, inspect button `[i]`.
- **Connector lines** between cards (simple vertical line with arrow, CSS-only, no React Flow needed).
- **Drag handles** on left side of each card for reordering.
- **[+ Add Step]** button at bottom opens a picker to add a new node (same as toolbar "Add Component", but pre-wires edges to the selected command).
- **Command dropdown** at top lists all Command nodes in the graph. Selecting one re-derives the workflow.
- **"New Workflow"** option in the dropdown opens a dialog to create a new Command node (name, description, prompt), then shows its (initially empty) workflow.

---

## 4. Component Breakdown

### New Files

| File | Purpose | Est. Lines |
|------|---------|-----------|
| `src/components/builder/WorkflowView.tsx` | Main workflow view component | ~200 |
| `src/components/builder/WorkflowStep.tsx` | Individual step card (draggable) | ~80 |
| `src/components/builder/WorkflowCommandSelector.tsx` | Command dropdown + "New" option | ~60 |
| `src/components/builder/EditWarningDialog.tsx` | "Amend vs Create New" confirmation dialog | ~50 |
| `src/lib/workflow/derive.ts` | Derive workflow sequence from graph | ~80 |

### Modified Files

| File | Change | Impact |
|------|--------|--------|
| `src/app/builder/page.tsx` | Add view toggle (Team Setup / Workflow), render WorkflowView conditionally | Low |
| `src/stores/builder-store.ts` | Add `activeView`, `selectedCommandId`, `workflowOrder` state + actions | Low |
| `src/components/builder/PropertyPanel.tsx` | Add edit warning when editing from workflow context | Low |
| `src/components/builder/Toolbar.tsx` | Remain unchanged (shared between views) | None |
| `src/lib/plugin-types.ts` | No changes needed | None |

### No New Dependencies

- Drag-and-drop: Use `@dnd-kit/core` + `@dnd-kit/sortable` (lightweight, ~15KB gzipped, well-maintained). React Flow's DnD is canvas-specific and not suitable for list reordering.
- All other UI uses existing shadcn components (Card, Badge, Select, Dialog, Button).

---

## 5. Detailed Technical Approach

### 5.1 Workflow Derivation (`src/lib/workflow/derive.ts`)

```typescript
interface WorkflowStep {
  nodeId: string;
  nodeType: PluginNodeType;
  name: string;
  description: string;     // one-line context
  tokenEstimate: number;
  phase: 'setup' | 'trigger' | 'execute' | 'entry';
}

function deriveWorkflow(
  commandNodeId: string,
  nodes: Node[],
  edges: Edge[]
): WorkflowStep[]
```

**Phase mapping:**
- `setup`: Rules that auto-load (always active context)
- `trigger`: Hooks that fire on events (conditional injection)
- `execute`: Skills/agents that perform work
- `entry`: The command itself (user invocation point)

Walk edges backwards from command node. Group by phase. Within each phase, sort by node creation order (timestamp in node ID).

### 5.2 View Toggle (`builder/page.tsx`)

Add to builder store:
```typescript
activeView: 'canvas' | 'workflow';
setActiveView: (view: 'canvas' | 'workflow') => void;
selectedCommandId: string | null;
setSelectedCommandId: (id: string | null) => void;
```

In the page, swap `<BuilderCanvas />` for `<WorkflowView />` based on `activeView`. The right panel (Properties / Dry Run) remains shared between both views.

### 5.3 Edit Warning Flow

When user clicks a step's inspect button `[i]`:
1. Set `selectedNodeId` (same as canvas click) to show PropertyPanel
2. When user modifies a field in PropertyPanel, intercept with `EditWarningDialog`
3. Dialog offers:
   - **"Amend [name]"** — proceeds with edit (warning: "This changes behavior everywhere this component is used")
   - **"Create copy"** — duplicates the node with `-copy` suffix, rewires edges to point at the copy, then opens the copy for editing
4. User choice is remembered per-session (checkbox: "Don't ask again this session")

Implementation: Add a `editWarningDismissed` boolean to builder store. In `updateNodeData`, if called from workflow context and not dismissed, show dialog first.

### 5.4 Drag Reorder

Use `@dnd-kit/sortable` for the step list. On reorder:
- Update a `workflowDisplayOrder: Record<string, string[]>` in builder store (keyed by command node ID, value is ordered array of node IDs)
- This is display-only metadata. It does not affect the graph, edges, or export.
- If no custom order exists for a command, fall back to the derived order.

### 5.5 Create New Workflow

The "New Workflow" option in the command dropdown:
1. Opens a small dialog: name (required), description, initial prompt
2. Creates a new Command node via `addNode('command')` + `updateNodeData`
3. Sets `selectedCommandId` to the new node
4. Workflow view shows empty state: just the command step, with [+ Add Step] to build the chain

### 5.6 Add Step from Workflow

The [+ Add Step] button:
1. Opens a picker showing available node types (same as toolbar)
2. Creates the new node
3. Auto-creates an edge connecting it to the appropriate node in the chain (e.g., new skill gets `skill → command` edge)
4. New step appears in the workflow

---

## 6. Workstream Breakdown

### WS-A: Derivation Engine + Store Extensions (0.5 days)

- Create `src/lib/workflow/derive.ts`
- Add `activeView`, `selectedCommandId`, `workflowDisplayOrder` to builder store
- Unit-testable in isolation (pure functions on graph data)

### WS-B: Workflow UI Components (1 day)

- `WorkflowView.tsx` — main container, command selector, step list
- `WorkflowStep.tsx` — individual step card with type badge, description, tokens, inspect button
- `WorkflowCommandSelector.tsx` — dropdown with command list + "New Workflow" option
- CSS for vertical timeline connector lines
- Wire into `builder/page.tsx` with view toggle tabs

### WS-C: Drag Reorder + Edit Warning (0.5 days)

- Install `@dnd-kit/core` + `@dnd-kit/sortable`
- Wrap step list in sortable container
- `EditWarningDialog.tsx` — amend vs create copy confirmation
- Wire edit warning into PropertyPanel entry point

### WS-D: Create New + Add Step (0.5 days)

- "New Workflow" dialog and handler
- [+ Add Step] picker and auto-edge creation
- Edge cases: deleting the last step, deleting the command itself

### WS-E: Polish + Testing (0.5 days)

- Empty state (no commands exist yet)
- Responsive behavior
- Keyboard navigation (arrow keys through steps)
- Visual consistency with canvas view (same color scheme, badges)

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Edge derivation misses indirect connections | Medium | Medium | Test against all 5 templates; add test for deep chains (agent → skill → command) |
| Drag reorder feels disconnected from graph | Low | Low | Clear UI label: "Display order only — execution order is determined by Claude Code" |
| Edit warning becomes annoying | Medium | Low | "Don't ask again" checkbox; only trigger from workflow context, not canvas |
| @dnd-kit bundle size | Low | Low | Tree-shakeable; core + sortable is ~15KB gzipped |

**Overall risk: 4/10** — No new infrastructure, no backend changes, no auth, no data model changes. Pure frontend feature using existing data.

---

## 8. Success Criteria

1. User can toggle between Team Setup and Workflow views without losing state
2. Selecting a command shows its full execution chain in correct phase order
3. Clicking a step opens PropertyPanel with correct node selected
4. Drag reorder persists within session and does not corrupt the graph
5. "Create copy" produces a working independent node with correct edges
6. New workflow creation adds a Command node visible in both views
7. All 5 existing templates render correctly in workflow view
8. Static export still works (workflow view is display-only, no export side effects)

---

## 9. Dependencies on Existing Code

| Dependency | Status | Risk |
|------------|--------|------|
| `builder-store.ts` (Zustand) | Stable, well-structured | Low — additive changes only |
| `plugin-types.ts` (types, colors, labels) | Stable | None — read-only usage |
| `simulation/engine.ts` (traversal logic) | Stable | Low — extract patterns, don't modify |
| `PropertyPanel.tsx` | Stable | Low — add conditional dialog wrapper |
| `@xyflow/react` | v12, stable | None — not used by workflow view |
| `shadcn/ui` components | Installed | None — Card, Badge, Select, Dialog all available |

---

## 10. What This Plan Does NOT Cover

- **Workflow persistence to database** — Currently no database is connected (static export app). Workflows derive from the in-memory graph.
- **Workflow sharing/templates** — Defer to when template gallery exists.
- **Multi-command orchestration** — Showing how multiple commands interact. Each workflow is per-command.
- **Runtime simulation** — The Dry Run panel already covers this. Workflow view is structural, not simulated.
