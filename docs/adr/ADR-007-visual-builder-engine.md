# ADR-007: Visual Builder Engine — React Flow (@xyflow/react)

**Status:** Accepted
**Date:** 2026-03-28
**Decision Makers:** Solutions Architect (Claude)

---

## Institutional Memory Check

Related ADRs: None. No visual builder or canvas-based UI exists in the codebase.

Consistency Analysis:
- `my-ai-village` contains a React component (`HookFlow.tsx`) that visualizes agent pipelines. This suggests familiarity with flow-based visualization concepts, though it may use a simpler approach than a full graph editor.

---

## Context

The visual builder is the core product surface. Users create Claude Code plugins by visually configuring:

| Concept | Claude Code Equivalent | Visual Representation |
|---------|----------------------|----------------------|
| **Hooks** | `PreToolUse`, `PostToolUse`, `SubagentStart`, etc. | Event trigger nodes with matchers |
| **Skills** | Skill markdown files with prompts | Skill block nodes with config panels |
| **Rules** | Rule markdown files in `.claude/rules/` | Rule nodes with content editors |
| **Commands** | Slash command files | Command nodes with argument config |
| **Agents** | Agent definition files | Agent nodes with model/tool config |
| **Connections** | Hook matchers → skill/rule injection | Edges between trigger and action nodes |

The builder must support:
1. **Drag-and-drop** — add nodes from a palette to a canvas
2. **Edge connections** — connect hook triggers to actions (skill injection, rule loading)
3. **Config panels** — click a node to edit its properties in a side panel
4. **Live preview** — see the generated `.claude/` directory structure update in real time
5. **Validation** — highlight invalid configurations (missing required fields, circular dependencies)
6. **Undo/redo** — full history stack

---

## Decision

Use **React Flow (@xyflow/react v12)** as the visual builder engine.

---

## Options Considered

### Option A: React Flow (@xyflow/react) — SELECTED

**Pros:**
- Purpose-built for node-based graph editors in React
- Battle-tested in production (used by Stripe, Typeform, and many workflow builders)
- Rich API: custom nodes, custom edges, minimap, controls, background
- Built-in features: drag-and-drop, zoom/pan, selection, keyboard shortcuts
- Excellent TypeScript support
- Active development (v12 released 2025, well-maintained)
- MIT licensed for open-source use, Pro license for additional features
- Handles 1000+ nodes performantly (canvas virtualization)
- Sub-flows support (nested groups for organizing complex plugins)

**Cons:**
- Pro license ($299/year) needed for some features (helper lines, node resizer) — acceptable cost
- Learning curve for custom node/edge types
- Opinionated about layout (automatic layout requires integration with dagre/elkjs)
- Large library (~50KB gzipped) added to client bundle

### Option B: Custom Canvas (HTML5 Canvas / SVG)

**Pros:**
- Maximum control over rendering and interaction
- No dependency on external library
- Potentially smaller bundle

**Cons:**
- Enormous implementation effort (6+ months for feature parity with React Flow)
- Must build drag-and-drop, zoom/pan, selection, undo/redo, keyboard shortcuts from scratch
- Must handle accessibility ourselves
- Must solve canvas virtualization for performance
- High ongoing maintenance burden

### Option C: Blockly (Google)

**Pros:**
- Well-known block-based programming interface
- Generates code/config from visual blocks
- Accessibility built in

**Cons:**
- Block-based paradigm is wrong for this domain — plugins are not sequential programs, they are configuration graphs
- Visual language is too restrictive for the flexibility needed
- Blockly's styling is hard to customize to match a modern design system
- Aimed at educational contexts, not developer tools

### Option D: Rete.js

**Pros:**
- Full-featured visual programming framework
- Built-in data flow engine

**Cons:**
- Smaller community than React Flow
- More complex API (visual programming engine, not just a graph editor)
- Over-engineered for configuration editing (we don't need data flow execution)
- Less TypeScript support

---

## Consequences

### Positive

1. **Fast time to MVP** — React Flow provides 80% of the builder UX out of the box
2. **Custom nodes** — each Claude Code concept (hook, skill, rule) gets its own node type with tailored UI
3. **Performant** — canvas virtualization handles complex plugin configurations
4. **Extensible** — can add AI-assisted layout, auto-connection suggestions as custom features
5. **Community** — large ecosystem of examples and integrations to reference

### Negative

1. **Pro license cost** — $299/year for advanced features (acceptable)
2. **Client-heavy** — the entire builder is a `'use client'` subtree in Next.js (no server component benefits)
3. **React Flow paradigm constraints** — must map Claude Code concepts to nodes/edges (may require creative abstraction for some concepts)

### Trade-off

A custom canvas would give maximum control but cost 6+ months of engineering time. React Flow gives us 80% of the functionality in 2-3 weeks, with the remaining 20% achievable through custom nodes and extensions. The Pro license cost ($299/year) is trivial compared to the engineering time saved.

---

## Implementation Notes

### Node Types

```typescript
// Custom node types mapped to Claude Code concepts
const nodeTypes = {
  hookTrigger: HookTriggerNode,      // PreToolUse, PostToolUse, etc.
  hookAction: HookActionNode,        // Command to run when hook fires
  skill: SkillNode,                  // Skill definition with prompt
  rule: RuleNode,                    // Rule with content
  command: CommandNode,              // Slash command
  agent: AgentNode,                  // Agent definition
  settingsGroup: SettingsGroupNode,  // settings.json section
};

// Custom edge types
const edgeTypes = {
  hookConnection: HookConnectionEdge,  // Hook trigger → action
  reference: ReferenceEdge,            // Skill references rule, etc.
};
```

### State Management

The builder graph state (nodes, edges, viewport) will be managed by React Flow's built-in state + Zustand for the broader builder state (selected node, side panel content, preview output, undo/redo history).

```typescript
interface BuilderStore {
  // React Flow manages nodes/edges internally
  selectedNodeId: string | null;
  sidePanel: 'properties' | 'preview' | 'validation' | null;
  previewOutput: ClaudePackage | null;
  undoStack: BuilderSnapshot[];
  redoStack: BuilderSnapshot[];
  isDirty: boolean;
}
```

### Preview Engine

A pure function that converts the React Flow graph (nodes + edges + config) into a `.claude/` directory structure:

```typescript
function graphToClaudePackage(
  nodes: Node<PluginNodeData>[],
  edges: Edge[]
): ClaudePackage {
  // Traverse graph → generate settings.json, rules/*.md, skills/*/skill.md, etc.
}
```

This runs on every graph change (debounced) to provide real-time preview.

---

## Related ADRs

- ADR-001: Frontend Framework (Next.js hosts the builder)
- ADR-009: AI Integration (AI-assisted config generation within builder)
