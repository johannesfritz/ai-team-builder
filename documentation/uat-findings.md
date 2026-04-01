# UAT Findings: Two Archetypal Use Cases

**Date:** 2026-04-01
**Tested on:** localhost:3099 (same build as jfritz.xyz/ai-team-builder)
**Template:** Code Review Standards (3 nodes, 1 edge)

---

## Use Case 1: "Add a /validate-data command"

**Persona:** Data scientist extending existing plugin with a data validation workflow.
**Steps:** Create Command → fill fields → Create Rule → fill fields → Switch to Workflow → Select new command → Export

### Findings

| # | Type | Location | Issue | Severity |
|---|------|----------|-------|----------|
| F1 | UX | Toolbar → + Command | Node created immediately with empty fields. No guided wizard. User sees "/untitled" in the card grid. | Medium |
| F2 | UX | Team Setup card | Draft nodes show "/untitled" — looks like a real command. Should show "New command (draft)" or similar to distinguish incomplete items. | Low |
| F3 | UX | PropertyPanel | "Display Label" doesn't auto-derive from the name field. User has to manually update both. Label should follow name: "validate-data" → "Validate Data". | Low |
| F4 | UX | PropertyPanel → Prompt | Textarea too small for multi-line prompts. No markdown preview. No expandable/fullscreen editor. User writing a 10-line prompt can't see it all. | Medium |
| F5 | UX | PropertyPanel → Prompt | No guidance on prompt structure patterns. Help tooltip says "what Claude sees" but doesn't suggest patterns (numbered steps, output format section, etc.) | Medium |
| F6 | **BUG** | Workflow → Command selector | Dropdown display shows internal node ID (e.g., "command-1775058447686") instead of command name ("/validate-data"). Dropdown OPTIONS show correct names, but the TRIGGER TEXT uses the raw ID. | **High** |
| F7 | UX | Workflow → Command selector | First-time user doesn't know "c1" maps to "/review". No visible correlation between the ID and the command. | High (caused by F6) |
| F8 | Conceptual | Workflow view | Both commands show identical workflows — all rules, all hooks appear under every command. User expects: "/validate-data should show data-validation rule but NOT code-standards rule." | High |
| F9 | Missing | Workflow view | No way to scope a rule to a specific command. Rules are global by design in Claude Code, but users expect command-specific configuration. Need explainer text. | Medium |
| F10 | UX | Workflow → derivation | The derivation includes ALL rules and ALL hooks regardless of the selected command. It should filter to only show connected/relevant components, or clearly label shared vs command-specific items. | High |
| F11 | Missing | Workflow → + Add Step | The "+ rule" button at bottom adds a generic rule, doesn't pre-wire it to the selected command. User has no way to associate the new rule with this specific workflow. | Medium |

---

## Use Case 2: "Add a documentation agent"

**Persona:** Team lead adding a doc-generation agent with skills and a hook.
**Steps:** Create Agent → fill fields → (want to add Skill + Hook but test export first) → Export

### Findings

| # | Type | Location | Issue | Severity |
|---|------|----------|-------|----------|
| F12 | UX | PropertyPanel → Allowed Tools | Plain text input for tool names. User has to know exact tool names. Should be a multi-select checklist with standard Claude tools (Read, Write, Edit, Bash, Grep, Glob, WebSearch, Agent, WebFetch). | Medium |
| F13 | UX | PropertyPanel → Model | Default is "sonnet" but guidance says "Use model: inherit." Default should match the recommendation. | Low |
| F14 | UX | Export modal | Raw text dump (flat pre block) is hard to scan. Should show a structured file tree with expandable sections per file. | Medium |
| F15 | Missing | Export modal | No "Copy install command" button or post-export guidance. User downloads JSON but doesn't know what to do next. Need: step-by-step install instructions. | Medium |
| F16 | UX | Export modal | Partially visible UI behind the modal is distracting. Needs better backdrop or full-screen overlay. | Low |

---

## Cross-Cutting Findings

| # | Type | Issue | Severity |
|---|------|-------|----------|
| F17 | Missing | No "Save" concept. Everything is in-memory (Zustand store). Refresh = lose everything. Need localStorage persistence or explicit save/load. | **Critical** |
| F18 | Missing | No confirmation before destructive actions. "Delete Component" button has no "Are you sure?" dialog. | Medium |
| F19 | UX | The Toolbar "Add Component" buttons duplicate the "+ Add" buttons in each section. Two paths to the same action = confusion about which to use. | Low |
| F20 | Missing | No way to connect components (create edges) from the Team Setup view. Edges can only be drawn in the Workflow (canvas) view, but that view was removed in favor of the timeline. The relationship model (hook→rule, agent→skill) is invisible. | **High** |

---

## Priority Fixes

### P0: Must fix before next demo
1. **F6: Command selector shows node IDs** — Bug, fix in WorkflowCommandSelector or derive.ts
2. **F17: No persistence** — Add localStorage auto-save on every store change
3. **F20: No way to create edges** — Need either a connection UI in Team Setup or restore the canvas as a sub-view

### P1: Fix for usability
4. **F10: Workflow shows all components for every command** — Filter derivation to only edge-connected components; label shared items differently
5. **F8/F9: Users confused about global vs scoped** — Add explanatory text: "Rules load for all commands. Use path filters to scope when they're active."
6. **F12: Tools as checklist** — Replace text input with multi-select for allowed tools
7. **F4: Larger prompt editor** — Expandable textarea or fullscreen markdown editor
8. **F14: Export as file tree** — Structured export view with per-file sections

### P2: Polish
9. **F1: Guided creation wizard** — Step-by-step dialog before node creation
10. **F3: Auto-derive display label** — name → Label
11. **F5: Prompt template guidance** — Better help text with structure patterns
12. **F13: Default model to inherit** — Match recommendation
13. **F15: Post-export instructions** — Install guide
14. **F18: Delete confirmation** — "Are you sure?" dialog

---

## Screenshots

| File | What it shows |
|------|---------------|
| uat-uc1-start.png | Initial Team Setup with Code Review template |
| uat-uc1-step1-new-command.png | New command created, validation errors visible |
| uat-uc1-step2-filled-command.png | Command filled in, card updated |
| uat-uc1-step3-workflow.png | Workflow view showing /review (first found bug: "c1" in dropdown) |
| uat-uc1-step4-validate-data-workflow.png | Workflow for /validate-data (shows internal ID in dropdown) |
| uat-uc2-step1-new-agent.png | New agent with validation warnings |
| uat-uc2-step2-export.png | Export preview showing all 7 files |
