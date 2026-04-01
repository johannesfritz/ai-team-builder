# UAT Protocol: Bot the Builder — MVP

**Created:** 2026-03-28
**Technical Spec:** ADR-001 through ADR-009 (see `docs/adr/`)
**Complexity:** High — 4 distinct product surfaces, GitHub OAuth, React Flow canvas, Python sidecar, Vercel Services
**Scope:** MVP only. No payments, no machine improvement, no real-time collaboration.

---

## Table of Contents

1. [User Journeys](#1-user-journeys)
2. [Acceptance Criteria](#2-acceptance-criteria)
3. [Backend Test Specifications](#3-backend-test-specifications)
4. [Edge Case Matrix](#4-edge-case-matrix)
5. [Regression Checklist](#5-regression-checklist)
6. [Accessibility Testing Checklist](#6-accessibility-testing-checklist)
7. [UAT Execution Checklist](#7-uat-execution-checklist)

---

## 1. User Journeys

### Journey 1: GitHub OAuth Sign-In

**Goal:** User authenticates with GitHub and lands on their dashboard.

**Preconditions:**
- User has a GitHub account
- App is accessible at root URL
- GitHub OAuth App is configured with correct callback URL

**Steps:**

1. Navigate to: `/`
   - Expected: Landing page renders with "Sign in with GitHub" call-to-action
   - Verify: `<a>` or `<button>` with text "Sign in with GitHub" is visible and enabled
   - Verify: No dashboard content is visible to unauthenticated user

2. Click "Sign in with GitHub"
   - Expected: Browser redirects to `github.com/login/oauth/authorize`
   - Verify: URL contains `client_id` parameter matching the app's GitHub OAuth App ID
   - Verify: `scope` parameter contains `read:user user:email repo`

3. Authorize on GitHub (user clicks "Authorize" on GitHub's page)
   - Expected: GitHub redirects back to `/api/auth/callback/github`
   - Verify: NextAuth.js callback processes the code
   - Verify: User record is created in `users` table with `github_id`, `email`, `display_name`, `avatar_url`
   - Verify: Session is created in `sessions` table

4. Land on dashboard
   - Expected: Redirect to `/dashboard`
   - Verify: User's GitHub avatar and display name visible in navigation
   - Verify: "My Plugins" section renders (may be empty)
   - Verify: "Create Plugin" button is visible

**Postconditions:**
- `users` table has one row for this GitHub account
- `sessions` table has an active session record
- Subsequent page loads do not require re-authentication

**Happy Path Result:** User is authenticated, sees their empty dashboard, ready to create a plugin.

**test_command:** `npx playwright test tests/e2e/auth.spec.ts::test_github_oauth_happy_path -x`

---

### Journey 2: Plugin Creation from Scratch

**Goal:** Technical Creator builds a complete plugin with rule, hook, and command components, then exports it to GitHub.

**Preconditions:**
- User is authenticated (Journey 1 complete)
- User is on `/dashboard`
- User has authorized the Bot the Builder GitHub App for repo creation

**Steps:**

1. Navigate to: `/dashboard`
   - Expected: Dashboard renders with "Create Plugin" button
   - Verify: Button is clickable

2. Click "Create Plugin"
   - Expected: Modal or page for plugin metadata appears
   - Verify: Form has fields: name (required), description, category (select), visibility (public/private)

3. Fill plugin metadata
   - Input: name = "My Test Plugin", description = "A UAT test plugin", category = "Productivity"
   - Click "Create"
   - Expected: POST to `/api/plugins` returns 201 with `{id, slug, name, owner_id}`
   - Verify: Row inserted in `plugins` table with `is_public = false`, `owner_id` = authenticated user
   - Verify: Redirect to `/builder/[plugin-slug]`

4. Builder canvas loads
   - Expected: React Flow canvas renders with empty state
   - Verify: Node palette/sidebar visible with available node types (Rule, Hook, Command, Skill, Agent)
   - Verify: "Preview" panel toggle visible
   - Verify: "Run Dry Run" button visible but disabled (no prompt entered)
   - Verify: "Export to GitHub" button visible

5. Add a Rule component
   - Action: Drag "Rule" node type from palette onto canvas, OR click "Add Rule" button
   - Expected: Rule node appears on canvas
   - Verify: Node renders with label "Rule" and a configuration icon
   - Click the node to open config panel
   - Input: path filter = `**/*.py`, content = `# Python Style Rule\nAlways use type hints.`
   - Verify: Config panel saves on blur or explicit save; node label updates to reflect the rule name/path

6. Add a Hook component
   - Action: Drag "Hook" node onto canvas
   - Expected: Hook node appears
   - Click to open config panel
   - Input: event = `PreToolUse`, matcher = `tool_name == "Bash"`, action type = `inject_skill`
   - Verify: Config panel accepts all inputs without validation errors
   - Verify: Edge can be drawn from Hook node to the Rule node created in step 5

7. Add a Command component
   - Action: Drag "Command" node onto canvas
   - Expected: Command node appears
   - Click to open config panel
   - Input: slash command name = `my-command`, description = "Does something useful", prompt = "When invoked, summarize the current file."
   - Verify: Command name field validates: no spaces, no leading `/`, lowercase

8. Preview component tree
   - Action: Click "Preview" toggle in the sidebar
   - Expected: Preview panel shows the generated `.claude/` directory structure
   - Verify: `plugin.json` is present with name/description/version
   - Verify: `rules/` directory contains a file for the rule component
   - Verify: `hooks/hooks.json` contains the hook definition
   - Verify: `commands/` directory contains the command file
   - Verify: Preview updates in real time as graph changes (debounced, within 500ms)

9. Run structural dry run
   - Action: Type a sample prompt in the dry run input field: "Run `python lint.py` on all files"
   - Click "Run Simulation"
   - Expected: Request to `/api/ai/dry-run` (Python sidecar)
   - Expected: Loading state visible (spinner or progress indicator)
   - Expected: Result panel shows simulation trace within 30 seconds
   - Verify: Trace shows which rules loaded, which hooks fired, which commands registered
   - Verify: Token cost estimate is displayed (non-zero, reasonable range)
   - Verify: No console errors

10. Export to GitHub
    - Action: Click "Export to GitHub"
    - Expected: Confirmation dialog or panel shows:
      - Target repo name (derived from plugin slug)
      - File list preview
      - "Confirm Export" button
    - Click "Confirm Export"
    - Expected: POST to `/api/plugins/[id]/export`
    - Expected: Loading state for up to 30 seconds (GitHub API calls)
    - Expected: Success state with link to GitHub repo
    - Verify: GitHub repo created in user's account containing `.claude-plugin/` structure
    - Verify: `plugin.json`, `rules/`, `hooks/hooks.json`, `commands/` present in repo
    - Verify: Plugin record in `plugins` table updated with `github_repo` URL

**Postconditions:**
- Plugin exists in `plugins` table with `github_repo` set
- Latest version exists in `plugin_versions` table with `config` (builder state) and `claude_package` (generated structure)
- GitHub repo exists and is accessible

**Happy Path Result:** Plugin is live on GitHub, ready for `claude plugin add`.

**test_command:** `npx playwright test tests/e2e/builder-scratch.spec.ts -x`

---

### Journey 3: Plugin Creation from Template

**Goal:** Non-Technical Creator finds a template in the gallery and customizes it into their own plugin.

**Preconditions:**
- User is authenticated
- At least 5 templates exist in the system

**Steps:**

1. Navigate to: `/dashboard` or `/templates`
   - Expected: "Templates" section or tab visible
   - Verify: Gallery shows at least 5 starter template cards
   - Verify: Each card shows: name, description, category badge, component count

2. Click on a template card (e.g., "Code Review Assistant")
   - Expected: Template detail view or modal appears
   - Verify: Preview of the component structure is shown
   - Verify: "Use This Template" button is visible

3. Click "Use This Template"
   - Expected: Plugin creation flow starts with template data pre-filled
   - Verify: POST to `/api/plugins` with `template_id` parameter
   - Verify: Builder opens with nodes pre-populated from template
   - Verify: All nodes are editable (not locked)

4. Customize a component
   - Action: Click the pre-populated Rule node
   - Modify the content text
   - Verify: Changes are reflected in the Preview panel
   - Verify: The plugin is marked as "unsaved" (dirty state indicator)

5. Save and export
   - Same as Journey 2, steps 8-10
   - Verify: Exported plugin contains the customized content, not the original template content

**Postconditions:**
- New plugin record in `plugins` table with `template_id` reference

**Happy Path Result:** User has a customized plugin ready for export in under 5 minutes.

**test_command:** `npx playwright test tests/e2e/builder-template.spec.ts -x`

---

### Journey 4: Marketplace Browse and Install

**Goal:** Consumer discovers a plugin and downloads it for installation.

**Preconditions:**
- At least 3 published public plugins exist in the marketplace
- User is NOT authenticated (anonymous access)

**Steps:**

1. Navigate to: `/marketplace`
   - Expected: Page renders without auth required
   - Verify: Plugin cards visible (server-side rendered — check with JS disabled)
   - Verify: Search bar visible
   - Verify: Category filter visible

2. Browse plugins
   - Verify: Each card shows: name, description, author (GitHub handle), category, download count
   - Verify: Cards are clickable

3. Search by keyword
   - Input: "python" in search bar
   - Expected: Results filter within 300ms (debounced)
   - Verify: Only plugins with "python" in name or description are shown
   - Verify: Empty state message shown if no results

4. Filter by category
   - Action: Select "Productivity" from category filter
   - Expected: Plugin list filters to Productivity category
   - Verify: URL updates to reflect filter (e.g., `?category=productivity`)
   - Verify: Filter state persists on browser back/forward

5. View plugin detail
   - Click a plugin card
   - Expected: Navigate to `/marketplace/[plugin-slug]`
   - Verify: Page shows: name, description, author, version, component breakdown
   - Verify: Component list shows each rule/hook/command with its description
   - Verify: "Download" button visible
   - Verify: "View on GitHub" link visible and opens correct GitHub repo

6. Download plugin package
   - Click "Download"
   - Expected: GET to `/api/plugins/[id]/download`
   - Expected: Browser downloads a `.zip` file
   - Verify: ZIP file name matches plugin slug (e.g., `code-review-assistant.zip`)
   - Verify: ZIP contains `.claude-plugin/` directory at root
   - Verify: `plugin.json` is valid JSON with required fields: `name`, `version`, `description`, `author`
   - Verify: Directory structure matches the plugin's component configuration

7. See install instructions
   - After download, Expected: Install instructions are displayed (inline or modal):
     ```
     Unzip and run: claude plugin add ./code-review-assistant/
     ```
   - Verify: Instructions are correct and complete

**Postconditions:**
- Plugin `download_count` incremented in database
- ZIP file served correctly

**Happy Path Result:** Consumer has downloaded the plugin and knows how to install it.

**test_command:** `npx playwright test tests/e2e/marketplace.spec.ts -x`

---

### Journey 5: Dry Run Simulation (Standalone)

**Goal:** Creator iterates on their plugin configuration by understanding what fires for different prompts.

**Preconditions:**
- User is authenticated
- Plugin has at least one hook and one rule defined
- Builder is open at `/builder/[plugin-slug]`

**Steps:**

1. Open existing plugin in builder
   - Navigate to `/builder/[plugin-slug]`
   - Expected: Canvas loads with saved nodes and edges
   - Verify: Node positions and connections are restored from saved state

2. Enter sample prompt
   - Click into the dry run input field (bottom panel or sidebar)
   - Input: "Read the file `main.py` and explain it"
   - Verify: "Run Simulation" button becomes enabled

3. Run structural simulation
   - Click "Run Simulation"
   - Expected: POST to `/api/ai/dry-run` with `{ plugin_config, prompt }`
   - Expected: Loading indicator visible
   - Expected: Response within 30 seconds

4. Examine trace output
   - Expected: Trace panel shows:
     - Which rules loaded (with rule name and reason)
     - Which hooks fired (with event type and matched condition)
     - Which commands were registered (with slash command name)
     - Which skills were injected (if any)
   - Verify: Each trace entry has a clear label and explanation
   - Verify: Rules/hooks that did NOT fire are listed with reason why not

5. View token cost estimate
   - Expected: Token estimate displayed as: "~N tokens (rules: X, hooks: Y, commands: Z)"
   - Verify: Estimate is non-zero when components fire
   - Verify: Estimate is zero or near-zero when no components fire

6. Iterate
   - Modify a hook's matcher condition in the config panel
   - Re-run simulation with same prompt
   - Verify: Trace output updates to reflect the change
   - Verify: Token estimate updates accordingly

**Postconditions:**
- No state change in database (dry run is read-only)

**Happy Path Result:** Creator understands exactly which plugin components activate for different prompt types and has adjusted the configuration accordingly.

**test_command:** `npx playwright test tests/e2e/dry-run.spec.ts -x`

---

## 2. Acceptance Criteria

### AC-1: GitHub OAuth Authentication — F1

**Given:** An unauthenticated user visits any protected route (`/dashboard`, `/builder/*`)
**When:** They are redirected to the sign-in page and click "Sign in with GitHub"
**Then:** After successful GitHub authorization, they land on `/dashboard` with a valid session
**Verification:** Check `sessions` table for a record with the user's `github_id`; verify session cookie is set; verify protected routes are now accessible
**test_command:** `npx playwright test tests/e2e/auth.spec.ts::test_github_oauth_happy_path -x`

---

### AC-2: Session Persistence — F1

**Given:** An authenticated user closes and reopens the browser (within session TTL)
**When:** They navigate to a protected route
**Then:** They remain authenticated without re-authenticating
**Verification:** Set session cookie; navigate to `/dashboard`; verify 200 response, no redirect to sign-in
**test_command:** `npx playwright test tests/e2e/auth.spec.ts::test_session_persistence -x`

---

### AC-3: Unauthenticated Marketplace Access — F2

**Given:** An anonymous user (no session)
**When:** They navigate to `/marketplace`
**Then:** The page renders fully with plugin listings, no redirect to sign-in
**Verification:** Playwright test with `storageState: {}` (no cookies); confirm page title, plugin cards, and search bar are present
**test_command:** `npx playwright test tests/e2e/marketplace.spec.ts::test_anonymous_access -x`

---

### AC-4: Plugin CRUD — F3

**Given:** An authenticated user
**When:** They create a new plugin via `POST /api/plugins`
**Then:** A record is inserted in the `plugins` table with correct `owner_id` and the response contains `{id, slug, name}`
**Verification:** `pytest tests/api/test_plugins.py::test_create_plugin -x`
**test_command:** `pytest tests/api/test_plugins.py::test_create_plugin -x`

---

### AC-5: Builder Canvas — Node Palette — F4

**Given:** An authenticated user with a plugin open in the builder
**When:** The builder page loads at `/builder/[slug]`
**Then:** The React Flow canvas renders with a node palette containing at minimum: Rule, Hook, Command, Skill node types
**Verification:** `data-testid` attributes on each palette item; assert they are present and draggable
**test_command:** `npx playwright test tests/e2e/builder-canvas.spec.ts::test_palette_items -x`

---

### AC-6: Builder Canvas — Node Addition — F4

**Given:** The builder canvas is open and empty
**When:** The user drags a Rule node from the palette to the canvas
**Then:** A Rule node appears at the drop position with a unique `id`, and the builder state is marked dirty
**Verification:** Assert React Flow node list has length 1 with `type === 'rule'`; assert dirty state indicator is visible
**test_command:** `npx playwright test tests/e2e/builder-canvas.spec.ts::test_add_rule_node -x`

---

### AC-7: Builder Canvas — Edge Connections — F4

**Given:** A Hook node and a Rule node exist on the canvas
**When:** The user draws an edge from the Hook node's output handle to the Rule node's input handle
**Then:** An edge is created in the graph state connecting the two nodes
**Verification:** Assert React Flow edge list has length 1 with correct `source` and `target` node IDs
**test_command:** `npx playwright test tests/e2e/builder-canvas.spec.ts::test_connect_nodes -x`

---

### AC-8: Rule Node Configuration — F4

**Given:** A Rule node is on the canvas
**When:** The user clicks the node and fills in the path filter and content fields in the config panel
**Then:** The node's configuration is updated; the Preview panel reflects the rule content under `rules/[filename].md`
**Verification:** Assert preview panel text contains the entered content; assert node label updates
**test_command:** `npx playwright test tests/e2e/builder-canvas.spec.ts::test_rule_config -x`

---

### AC-9: Hook Node Configuration — F4

**Given:** A Hook node is on the canvas
**When:** The user selects event type `PreToolUse` and enters a matcher expression
**Then:** The hook is stored with correct event and matcher; `hooks/hooks.json` in the preview shows the hook
**Verification:** Assert preview panel JSON contains the hook with `event: "PreToolUse"` and the matcher string
**test_command:** `npx playwright test tests/e2e/builder-canvas.spec.ts::test_hook_config -x`

---

### AC-10: Command Node Configuration — F4

**Given:** A Command node is on the canvas
**When:** The user enters a slash command name, description, and prompt
**Then:** A file appears in the preview under `commands/[name].md` with the correct prompt content
**Verification:** Assert preview panel shows `commands/my-command.md` with prompt text
**test_command:** `npx playwright test tests/e2e/builder-canvas.spec.ts::test_command_config -x`

---

### AC-11: Real-Time Preview — F4

**Given:** The builder is open with the Preview panel visible
**When:** The user modifies any node's configuration
**Then:** The Preview panel updates to reflect the change within 500ms
**Verification:** Measure time between config change and preview DOM update; assert < 500ms
**test_command:** `npx playwright test tests/e2e/builder-canvas.spec.ts::test_preview_realtime -x`

---

### AC-12: Plugin Save — F3

**Given:** The builder has unsaved changes (dirty state)
**When:** The user clicks "Save" or navigates away (with auto-save)
**Then:** `PUT /api/plugins/[id]` is called; the `plugin_versions` table has a new row with the current `config` JSONB
**Verification:** `pytest tests/api/test_plugins.py::test_save_plugin_version -x`
**test_command:** `pytest tests/api/test_plugins.py::test_save_plugin_version -x`

---

### AC-13: Export to GitHub — F5

**Given:** An authenticated user with a fully configured plugin
**When:** They confirm the GitHub export
**Then:** A GitHub repo is created (or updated) in their account containing the valid `.claude-plugin/` structure; `plugins.github_repo` is set
**Verification:** Check GitHub API for repo existence; verify `plugin.json` in repo root is valid JSON; verify `pytest tests/api/test_export.py::test_export_creates_github_repo -x`
**test_command:** `pytest tests/api/test_export.py::test_export_creates_github_repo -x`

---

### AC-14: Valid Plugin Package Structure — F5

**Given:** Any plugin with at least one component
**When:** The export is triggered
**Then:** The generated `.claude-plugin/` structure passes structural validation: `plugin.json` present and valid, all referenced files exist, no empty required files
**Verification:** `pytest tests/unit/test_package_generator.py::test_valid_package_structure -x`
**test_command:** `pytest tests/unit/test_package_generator.py::test_valid_package_structure -x`

---

### AC-15: Structural Dry Run — F6

**Given:** A plugin with at least one rule and one hook, and a user-provided sample prompt
**When:** The dry run simulation is triggered via `POST /api/ai/dry-run`
**Then:** The response contains a trace with: fired hooks, loaded rules, registered commands, and a token estimate
**Verification:** `pytest tests/api/test_dry_run.py::test_dry_run_returns_trace -x`
**test_command:** `pytest tests/api/test_dry_run.py::test_dry_run_returns_trace -x`

---

### AC-16: Dry Run Is Read-Only — F6

**Given:** A dry run is executed
**When:** The simulation completes (success or failure)
**Then:** No records are inserted or modified in the `plugins`, `plugin_versions`, or `users` tables
**Verification:** Assert row counts before and after dry run are identical in all tables
**test_command:** `pytest tests/api/test_dry_run.py::test_dry_run_no_db_writes -x`

---

### AC-17: Template Gallery — F7

**Given:** An authenticated user on the templates page
**When:** The page loads
**Then:** At least 5 template cards are displayed, each with name, description, category, and a "Use This Template" button
**Verification:** `npx playwright test tests/e2e/templates.spec.ts::test_gallery_renders -x`
**test_command:** `npx playwright test tests/e2e/templates.spec.ts::test_gallery_renders -x`

---

### AC-18: Template Instantiation — F7

**Given:** A user clicks "Use This Template" on a template card
**When:** The builder opens
**Then:** The canvas is pre-populated with the template's nodes and edges; all nodes are editable; the plugin is a new record (not the template itself)
**Verification:** Assert node count matches template; assert new `plugin_id` differs from template `id`
**test_command:** `npx playwright test tests/e2e/builder-template.spec.ts::test_template_instantiation -x`

---

### AC-19: Marketplace Listing (SSR) — F8

**Given:** Any visitor (including web crawlers)
**When:** They request `/marketplace`
**Then:** The page is server-side rendered with plugin data; content is present in initial HTML (no client-side hydration required for initial render)
**Verification:** Fetch the page with a raw HTTP GET (no JS execution); assert plugin names appear in the HTML response body
**test_command:** `pytest tests/ssr/test_marketplace_ssr.py::test_marketplace_html_contains_plugins -x`

---

### AC-20: Marketplace Search — F8

**Given:** The marketplace page with at least 3 plugins across different names
**When:** The user types a keyword that matches only 1 plugin
**Then:** The displayed list filters to that 1 plugin within 300ms; URL updates to include `?q=keyword`
**Verification:** `npx playwright test tests/e2e/marketplace.spec.ts::test_search_filters -x`
**test_command:** `npx playwright test tests/e2e/marketplace.spec.ts::test_search_filters -x`

---

### AC-21: Plugin Download — F8

**Given:** A published public plugin on the marketplace
**When:** A user (authenticated or anonymous) clicks "Download"
**Then:** A `.zip` file is served containing the `.claude-plugin/` directory; `plugin.json` inside the zip is valid
**Verification:** `pytest tests/api/test_download.py::test_download_produces_valid_zip -x`
**test_command:** `pytest tests/api/test_download.py::test_download_produces_valid_zip -x`

---

### AC-22: Unauthorized Plugin Access — F3, F5

**Given:** User A's private plugin
**When:** User B (authenticated) or an anonymous user attempts to access `/builder/[user-a-slug]` or `GET /api/plugins/[id]`
**Then:** Response is 403 Forbidden (authenticated users) or 401 Unauthorized (anonymous); plugin data is not exposed
**Verification:** `pytest tests/api/test_auth.py::test_private_plugin_access_denied -x`
**test_command:** `pytest tests/api/test_auth.py::test_private_plugin_access_denied -x`

---

## 3. Backend Test Specifications

### Endpoint: POST /api/auth/callback/github (NextAuth.js)

This is handled by NextAuth.js internally. The integration contract:

**Expected side effects on successful OAuth:**
```json
{
  "users": {
    "github_id": "string (GitHub user ID)",
    "email": "string (primary GitHub email)",
    "display_name": "string (GitHub login or name)",
    "avatar_url": "string (GitHub avatar URL)",
    "created_at": "ISO8601"
  },
  "sessions": {
    "user_id": "UUID (references users.id)",
    "expires": "ISO8601 (TTL: 30 days default)"
  }
}
```

**Error cases:**
- GitHub returns error code: NextAuth.js redirects to `/api/auth/error?error=OAuthCallback`
- Token exchange fails: Same redirect; log error server-side

---

### Endpoint: POST /api/plugins

**Authentication:** Required (session cookie)

**Request:**
```json
{
  "name": "string (required, 3-64 chars)",
  "description": "string (optional, max 500 chars)",
  "category": "string (enum: productivity, code-quality, analysis, devops, other)",
  "is_public": "boolean (default: false)"
}
```

**Expected Response (201):**
```json
{
  "id": "UUID",
  "slug": "string (kebab-case, unique, derived from name)",
  "name": "string",
  "owner_id": "UUID",
  "created_at": "ISO8601"
}
```

**Error Cases:**
- 400: `name` missing or < 3 chars → `{"error": "validation_error", "field": "name", "message": "Name must be at least 3 characters"}`
- 400: `name` > 64 chars → `{"error": "validation_error", "field": "name", "message": "Name must be at most 64 characters"}`
- 400: `category` not in enum → `{"error": "validation_error", "field": "category", "message": "Invalid category"}`
- 401: No session → `{"error": "unauthorized"}`
- 409: Duplicate slug → `{"error": "conflict", "message": "A plugin with this name already exists"}`

**Database Effects:**
- Table `plugins`: new row with `owner_id` = authenticated user's ID, `is_public` = provided value

---

### Endpoint: PUT /api/plugins/[id]

**Authentication:** Required; must be plugin owner

**Request:**
```json
{
  "config": {
    "nodes": "[React Flow NodeData array]",
    "edges": "[React Flow Edge array]"
  },
  "metadata": {
    "name": "string (optional)",
    "description": "string (optional)"
  }
}
```

**Expected Response (200):**
```json
{
  "id": "UUID",
  "version_id": "UUID",
  "updated_at": "ISO8601"
}
```

**Error Cases:**
- 400: `config.nodes` is not a valid array → `{"error": "validation_error"}`
- 401: No session
- 403: Session user is not plugin owner → `{"error": "forbidden"}`
- 404: Plugin not found → `{"error": "not_found"}`

**Database Effects:**
- Table `plugins`: `updated_at` updated
- Table `plugin_versions`: new row with `config` = the submitted builder configuration JSONB

---

### Endpoint: POST /api/plugins/[id]/export

**Authentication:** Required; must be plugin owner

**Request:**
```json
{}
```

**Expected Response (202 Accepted, async job):**
```json
{
  "job_id": "string",
  "status": "queued",
  "estimated_seconds": 15
}
```

**Or (200, synchronous for small plugins):**
```json
{
  "github_repo": "https://github.com/user/plugin-slug",
  "files_created": ["plugin.json", "rules/my-rule.md", "hooks/hooks.json"]
}
```

**Error Cases:**
- 400: Plugin has no components → `{"error": "empty_plugin", "message": "Add at least one component before exporting"}`
- 401: No session
- 403: Not owner
- 422: GitHub App not authorized for user → `{"error": "github_not_authorized", "message": "Authorize the Bot the Builder GitHub App to create repos"}`
- 500: GitHub API error → `{"error": "github_api_error", "message": "Failed to create repository. GitHub returned: [error details]"}`

**Database Effects:**
- Table `plugins`: `github_repo` set to new repo URL
- Table `plugin_versions`: `claude_package` JSONB populated with generated file structure

**External Effects:**
- GitHub repo created at `github.com/[user]/[plugin-slug]`
- Repo contains `.claude-plugin/` directory with correct structure

---

### Endpoint: GET /api/plugins/[id]/download

**Authentication:** Not required (public plugins only)

**Request:** GET with no body

**Expected Response (200):**
```
Content-Type: application/zip
Content-Disposition: attachment; filename="[plugin-slug].zip"
[binary zip data]
```

**Error Cases:**
- 403: Plugin is not public → `{"error": "forbidden", "message": "This plugin is private"}`
- 404: Plugin not found → `{"error": "not_found"}`

**Zip Structure Must Contain:**
```
[plugin-slug]/
└── .claude-plugin/
    ├── plugin.json
    ├── README.md
    └── [component files based on config]
```

**plugin.json Must Validate Against:**
```json
{
  "name": "string (required)",
  "version": "string (semver, required)",
  "description": "string (required)",
  "author": "string (required, GitHub username)",
  "claude_code_min_version": "string (optional)"
}
```

**Database Effects:**
- Table `plugins`: `download_count` incremented by 1

---

### Endpoint: POST /api/ai/dry-run (Python Sidecar)

**Route:** `/api/ai/dry-run` (served by Python service at `routePrefix: /api/ai`)

**Authentication:** Required (forwarded from Next.js middleware)

**Request:**
```json
{
  "plugin_config": {
    "nodes": "[array of NodeData]",
    "edges": "[array of EdgeData]"
  },
  "prompt": "string (the user's sample prompt, max 2000 chars)",
  "tool_call": "string (optional, simulate specific tool call like 'Bash')"
}
```

**Expected Response (200):**
```json
{
  "trace": {
    "hooks_fired": [
      {
        "hook_id": "string",
        "event": "PreToolUse",
        "matcher": "tool_name == 'Bash'",
        "matched": true,
        "action": "inject_skill",
        "reason": "Bash tool detected in prompt"
      }
    ],
    "rules_loaded": [
      {
        "rule_id": "string",
        "name": "Python Style Rule",
        "path_filter": "**/*.py",
        "matched": true,
        "reason": "Prompt references .py context"
      }
    ],
    "commands_registered": [
      {
        "command_id": "string",
        "name": "my-command",
        "registered": true
      }
    ]
  },
  "token_estimate": {
    "total": 1450,
    "rules": 800,
    "hooks": 350,
    "commands": 300
  },
  "simulation_model": "claude-sonnet-4-20250514"
}
```

**Error Cases:**
- 400: `prompt` empty or > 2000 chars → `{"error": "validation_error"}`
- 400: `plugin_config` malformed → `{"error": "invalid_config"}`
- 401: No valid auth token
- 408: Simulation timeout (> 30s) → `{"error": "timeout", "message": "Simulation timed out"}`
- 500: Claude API error → `{"error": "ai_service_error", "message": "..."}`

**Database Effects:** None. Dry run is fully read-only.

---

### Endpoint: GET /api/marketplace

**Authentication:** Not required

**Query Parameters:**
- `q`: search string (optional)
- `category`: filter (optional, enum values)
- `page`: integer (default: 1)
- `per_page`: integer (default: 20, max: 100)

**Expected Response (200):**
```json
{
  "plugins": [
    {
      "id": "UUID",
      "slug": "string",
      "name": "string",
      "description": "string",
      "category": "string",
      "author": "string",
      "download_count": 0,
      "github_repo": "string"
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 20
}
```

**Error Cases:**
- 400: `page` < 1 or non-integer → `{"error": "validation_error"}`
- 400: `per_page` > 100 → `{"error": "validation_error"}`

---

## 4. Edge Case Matrix

### Authentication & Session

| Scenario | Input | Expected Behavior | Priority |
|----------|-------|-------------------|----------|
| GitHub OAuth denied | User clicks "Cancel" on GitHub auth page | Redirect to sign-in page with error message "Authorization was denied. Try again." | P1 |
| GitHub account without email | GitHub account has private email | Auth succeeds; `email` stored as null; user can still create plugins | P1 |
| Session expired mid-session | Session TTL reached while user is in builder | On next API call, return 401; redirect to sign-in; builder state preserved in localStorage | P1 |
| Double sign-in (two tabs) | User signs in on tab 1, then tab 2 simultaneously | Both sessions valid; no conflict; user sees same dashboard on both | P2 |
| Revoked GitHub token | User revokes Bot the Builder's GitHub access | Next repo operation fails with 422 and actionable "Re-authorize" prompt | P1 |
| Sign-out with unsaved changes | User clicks sign out while builder is dirty | Confirmation dialog: "You have unsaved changes. Sign out anyway?" | P2 |

### Plugin Builder

| Scenario | Input | Expected Behavior | Priority |
|----------|-------|-------------------|----------|
| Empty plugin export | Plugin with zero components | Export button disabled with tooltip "Add at least one component to export" | P1 |
| Duplicate rule path filter | Two Rule nodes with identical path filters | Warning indicator on nodes; validation error in preview; export blocked | P1 |
| Very large component count | 50+ nodes on canvas | Canvas remains responsive; no lag; virtualization active | P2 |
| Circular edge connection | Hook A → Skill B → Hook A (cycle) | Cycle detection; visual error indicator on edge; validation panel flags it | P2 |
| Long rule content | Rule content > 10,000 characters | Accepted; preview shows truncated preview with "View full" expansion | P2 |
| Special characters in command name | Command name: `my command!` or `My-Command` | Sanitized to `my-command`; user shown the sanitized value | P1 |
| Undo/redo across node deletion | Delete node, undo | Node restored with original configuration and edge connections | P1 |
| Browser refresh mid-build | User presses F5 with unsaved changes | Builder reopens; if auto-save: changes preserved. If no auto-save: last saved state shown | P1 |
| Concurrent edit (same user, two tabs) | User opens same plugin in two browser tabs | Last-write-wins on save; second save shows "This plugin was modified in another window" | P2 |
| Node config with empty required field | Submit hook with no event selected | Inline validation error on the event field; export blocked | P1 |
| Plugin name with special characters | Plugin name: `My Plugin #1 (v2)!` | Slug generated: `my-plugin-1-v2`; name stored as-is | P1 |
| Network failure during save | WiFi drops while saving | Error toast: "Failed to save. Retrying..."; retry with exponential backoff (3 attempts) | P1 |
| Network failure during export | GitHub API call fails mid-export | Error message with retry button; plugin record NOT updated with partial data | P1 |

### Dry Run

| Scenario | Input | Expected Behavior | Priority |
|----------|-------|-------------------|----------|
| Empty prompt | Dry run with `prompt: ""` | Run button disabled; tooltip: "Enter a sample prompt to simulate" | P1 |
| No hooks/rules fire | Prompt that matches no matchers | Trace shows all components with `matched: false` and reason; token estimate = 0 | P1 |
| All components fire | Prompt designed to trigger everything | All hooks/rules/commands shown as active; token estimate reflects all | P1 |
| Very long prompt | Prompt > 2000 characters | Client-side validation: truncate to 2000 with warning, OR block with char count | P1 |
| Dry run on unsaved changes | User has modified nodes but not saved | Dry run uses current unsaved state (not last saved); confirm this in UI | P2 |
| Concurrent dry runs | User rapidly clicks "Run Simulation" | Debounce or cancel-previous; only one request in flight at a time | P2 |
| Python sidecar cold start | First dry run after idle period | Loading indicator tolerates up to 10s cold start; no timeout error shown to user | P2 |
| Claude API timeout | Anthropic API takes > 30s | Show "Simulation timed out. Try a simpler prompt or try again." with retry button | P1 |
| Malformed plugin config | Somehow corrupt nodes array | Graceful error: "Plugin configuration is invalid. Please re-open the plugin." | P1 |

### Template Gallery

| Scenario | Input | Expected Behavior | Priority |
|----------|-------|-------------------|----------|
| Template gallery empty | No templates seeded in DB | Empty state: "No templates yet. Check back soon." | P1 |
| Template deleted after user starts editing | Template removed from DB while user edits a copy | User's plugin is unaffected (it's a copy, not a reference) | P1 |
| Template with maximum components | Template containing 20+ nodes | Instantiation completes within 5 seconds; canvas is not frozen | P2 |

### Marketplace

| Scenario | Input | Expected Behavior | Priority |
|----------|-------|-------------------|----------|
| Zero public plugins | Fresh database, no published plugins | Marketplace shows empty state: "No plugins yet. Be the first to publish!" | P1 |
| Search with no results | Query that matches nothing | Empty state: "No plugins found for '[query]'. Try a different search." | P1 |
| Search with special characters | Query: `<script>alert(1)</script>` | Query is escaped; no XSS; empty results shown | P1 |
| Very long plugin description | Description > 500 chars in card view | Card shows truncated description with "..." ellipsis | P2 |
| Download when GitHub repo deleted | Plugin in DB but GitHub repo removed | Download falls back to stored `claude_package` JSONB; succeeds | P1 |
| Concurrent downloads of same plugin | 10 simultaneous download requests | All succeed; `download_count` incremented correctly (no race condition — use SQL `UPDATE ... + 1`) | P2 |
| Page load with JS disabled | Access `/marketplace` with JS off | Core content (plugin names, descriptions) visible; search degrades gracefully | P2 |
| Category filter with URL sharing | User copies URL with `?category=productivity` | Shared URL opens with filter pre-applied | P2 |
| Pagination boundary | Navigate to page beyond total | 404 page or empty results with "No more plugins" message | P2 |

### Package Generation (ZIP/GitHub)

| Scenario | Input | Expected Behavior | Priority |
|----------|-------|-------------------|----------|
| Plugin with only a Rule | No hooks, no commands | ZIP contains only `plugin.json`, `rules/`, `README.md` — no empty directories | P1 |
| Plugin with Unicode content | Rule content in Japanese: `# ルール` | UTF-8 encoding preserved in ZIP and GitHub files | P1 |
| Plugin slug collision on GitHub | Another repo with same name exists in user's account | API returns 422 with message "A repository named '[slug]' already exists in your account." Suggest rename. | P1 |
| Re-export (update) | Plugin already has a GitHub repo; user re-exports | Update existing repo (push new commit) rather than creating a duplicate | P1 |
| Hook with no action connected | Hook node present but no edge drawn | Export blocked; validation: "Hook '[name]' has no action connected" | P1 |

---

## 5. Regression Checklist

This is a greenfield project with no existing code. The regression surface grows as the MVP is built. This checklist defines the minimum regression scope that must be verified before each release.

### Core Product Flows (Regression After Any Change)

| Feature | Test | Files Affected | Risk Level |
|---------|------|----------------|------------|
| GitHub OAuth sign-in | Full Journey 1 | `app/api/auth/`, `middleware.ts`, `lib/auth.ts` | High — auth breakage blocks everything |
| Plugin save/load roundtrip | Create plugin, save, reload, verify state | `app/api/plugins/`, `lib/db/schema.ts` | High — data loss if roundtrip breaks |
| Builder preview accuracy | Add node, verify preview matches | `lib/builder/graph-to-package.ts` | High — incorrect package generation |
| Marketplace SSR | Anonymous GET `/marketplace` returns HTML | `app/marketplace/page.tsx` | High — SEO regression |
| Plugin download integrity | Download ZIP, unzip, verify structure | `app/api/plugins/[id]/download/route.ts` | High — broken installs |

### Per-Workstream Regression Scope

| Workstream | Regression Risk | What to Verify |
|------------|----------------|----------------|
| Auth changes (NextAuth.js config, session schema) | High | All protected routes still require auth; public routes still allow anonymous access; session cookie still set correctly |
| DB schema changes (Drizzle migrations) | High | All CRUD endpoints return correct shapes; no null constraint violations on insert; foreign key integrity maintained |
| Builder canvas changes (React Flow nodes/edges) | Medium | Existing saved plugin configs still load correctly in the builder; graph-to-package conversion still produces valid output |
| Python sidecar changes (dry run logic) | Medium | Dry run returns trace within 30s; token estimates are positive; no uncaught exceptions on malformed configs |
| Package generator changes (`graph-to-package.ts`) | High | All 5 node types (Rule, Hook, Command, Skill, Agent) still produce correct file output; `plugin.json` is always valid JSON |
| Marketplace page changes | Low | SSR still works; search still filters; downloads still work |
| Vercel Services config changes (`vercel.json`) | High | Both services (`web` and `ai`) still route correctly; no CORS errors; `/api/ai/dry-run` reachable from frontend |

### Existing Tests to Run Before Merge

```bash
# Unit tests (Python sidecar)
pytest services/ai/tests/ -v

# Unit tests (TypeScript — package generator, validation)
npx jest tests/unit/ --runInBand

# API integration tests
pytest tests/api/ -v

# End-to-end tests (requires running app)
npx playwright test tests/e2e/ --reporter=list

# SSR verification
pytest tests/ssr/ -v
```

### Manual Regression Checks

- [ ] Sign in with GitHub succeeds and session persists across page reload
- [ ] Creating, saving, and reloading a plugin preserves all node types and configurations
- [ ] The preview panel in the builder accurately reflects the `.claude-plugin/` structure
- [ ] Downloading a plugin ZIP and unzipping it produces a valid directory structure installable with `claude plugin add`
- [ ] Marketplace page renders its full content when fetched as plain HTML (SSR check)
- [ ] Unauthenticated user cannot access `/dashboard` or `/builder/*`
- [ ] Authenticated user cannot access another user's private plugin

---

## 6. Accessibility Testing Checklist

**Standard:** WCAG 2.1 AA

### Automated Checks (run on every build)

```bash
npx playwright test tests/a11y/ --reporter=list
# Uses @axe-core/playwright for automated WCAG violation detection
```

Automated checks cover:
- [ ] No critical axe-core violations on `/` (landing), `/marketplace`, `/dashboard`, `/builder/[slug]`
- [ ] All images have non-empty `alt` attributes
- [ ] All form inputs have associated `<label>` elements
- [ ] Color contrast ratios pass WCAG AA (4.5:1 for normal text, 3:1 for large text)

### Manual Checks (per release)

**Keyboard Navigation:**
- [ ] Tab order is logical on landing page (logo → nav links → CTA)
- [ ] Sign-in button is reachable and activatable via keyboard
- [ ] Dashboard "Create Plugin" button is Tab-reachable
- [ ] Builder canvas: node palette items are keyboard-navigable
- [ ] Builder config panels: all form fields reachable via Tab; no keyboard trap
- [ ] Marketplace: search bar, category filter, and plugin cards are Tab-reachable
- [ ] Download button on plugin detail page is Tab-reachable and activatable via Enter/Space

**Screen Reader (NVDA + Chrome or VoiceOver + Safari):**
- [ ] Navigation landmark regions announced: `<nav>`, `<main>`, `<footer>`
- [ ] Page titles change on route navigation (SPA navigation announces new context)
- [ ] Loading states announced: "Loading..." or spinner with aria-label
- [ ] Error messages announced via `role="alert"` or `aria-live="assertive"`
- [ ] Builder canvas: React Flow nodes have `aria-label` with node type and name
- [ ] Modal dialogs: focus trapped within modal; announced as dialog; dismiss via Escape

**Focus Management:**
- [ ] After signing in, focus moves to dashboard heading or first actionable element
- [ ] After creating a plugin, focus moves to builder canvas or first node
- [ ] After a modal closes, focus returns to the triggering element
- [ ] After dry run completes, focus moves to the trace output panel

**Forms:**
- [ ] Plugin metadata form: required fields marked with `aria-required="true"` and visible indicator
- [ ] Validation errors: each error linked to its field via `aria-describedby`
- [ ] Character count feedback (e.g., description field): announced via `aria-live`

**Builder Canvas (React Flow):**
- [ ] Canvas has `role="application"` with `aria-label="Plugin builder canvas"`
- [ ] Each node type available in palette announced with its type name
- [ ] Connection handles have descriptive `aria-label` (e.g., "Output handle for Rule: Python Style")
- [ ] Minimap: has `aria-hidden="true"` (decorative, not keyboard navigable)

**Color and Visual:**
- [ ] No information conveyed by color alone (e.g., error states also have icon + text)
- [ ] Focus indicators are visible (not overridden to `outline: none` without replacement)
- [ ] Builder node validation errors use icon + text + color (not color only)

---

## 7. UAT Execution Checklist

### Pre-Launch Gates (All Must Pass)

**Authentication**
- [ ] AC-1: GitHub OAuth happy path
- [ ] AC-2: Session persistence
- [ ] AC-3: Unauthenticated marketplace access

**Plugin Builder**
- [ ] AC-4: Plugin CRUD (create, read, update)
- [ ] AC-5: Builder canvas palette
- [ ] AC-6: Node addition
- [ ] AC-7: Edge connections
- [ ] AC-8: Rule node configuration
- [ ] AC-9: Hook node configuration
- [ ] AC-10: Command node configuration
- [ ] AC-11: Real-time preview

**Export**
- [ ] AC-12: Plugin save (versions)
- [ ] AC-13: Export to GitHub creates valid repo
- [ ] AC-14: Package structure passes validation

**Dry Run**
- [ ] AC-15: Dry run returns trace
- [ ] AC-16: Dry run is read-only

**Templates & Marketplace**
- [ ] AC-17: Template gallery renders
- [ ] AC-18: Template instantiation
- [ ] AC-19: Marketplace SSR
- [ ] AC-20: Marketplace search
- [ ] AC-21: Plugin download
- [ ] AC-22: Private plugin access control

**Quality Gates**
- [ ] All user journeys (1–5) pass end-to-end in staging environment
- [ ] All backend API tests pass (`pytest tests/api/ -v`)
- [ ] All unit tests pass (`npx jest tests/unit/`)
- [ ] All Playwright e2e tests pass
- [ ] No console errors on any user journey
- [ ] axe-core: 0 critical violations on all 4 primary pages
- [ ] WCAG 2.1 AA keyboard navigation verified manually
- [ ] Performance: Marketplace page LCP < 2.5s (Vercel Speed Insights)
- [ ] Performance: Builder canvas loads within 3s on first open
- [ ] Dry run completes within 30s on median prompt length
- [ ] Plugin export completes within 30s on median plugin size
- [ ] Regression checklist verified: all 7 manual regression checks pass
- [ ] No uncommitted changes in production deploy

### Post-Launch Smoke Test (Run Immediately After Deploy)

```bash
# 1. Verify both Vercel Services are up
curl -f https://[production-url]/api/health
curl -f https://[production-url]/api/ai/health

# 2. Verify marketplace SSR
curl -s https://[production-url]/marketplace | grep -q "marketplace" && echo "PASS" || echo "FAIL"

# 3. Verify download endpoint (replace with a real plugin slug)
curl -I https://[production-url]/api/plugins/[test-slug]/download | grep -q "application/zip" && echo "PASS" || echo "FAIL"
```

- [ ] Both health endpoints return 200
- [ ] Marketplace HTML contains plugin content
- [ ] Download endpoint returns correct Content-Type
- [ ] Sign in with GitHub works in production (verify OAuth callback URL is set correctly for production domain)
- [ ] Create one test plugin end-to-end in production and immediately delete it
