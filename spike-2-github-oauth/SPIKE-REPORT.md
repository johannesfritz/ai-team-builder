# SPIKE-2: NextAuth.js (Auth.js v5) + GitHub OAuth + Repo Creation

**Date:** 2026-03-28
**Verdict:** GO

---

## Summary

A Next.js app can authenticate users via GitHub OAuth using Auth.js v5, capture their access token, and use it to create repos and push files on their behalf. The approach is well-documented, the APIs are stable, and there are no blocking limitations.

---

## Key Questions Answered

### 1. Does Auth.js v5 store the GitHub access token in the session by default?

**No.** Auth.js v5 does NOT expose the OAuth access token in the session by default. You must use custom `jwt` and `session` callbacks to capture and forward it.

The pattern:
- In the `jwt` callback, when `account` is present (first login), save `account.access_token` onto the JWT token object.
- In the `session` callback, copy `token.accessToken` onto the `session` object so client components can access it.

This is the standard Auth.js pattern for third-party API access and is well-documented in their "Integrating Third Party Backends" guide.

### 2. What's the minimum OAuth scope needed?

| Scope | What it grants |
|-------|---------------|
| `public_repo` | Create and push to **public** repos only |
| `repo` | Create and push to **public and private** repos |

For BotCamp, `public_repo` is sufficient if we only create public plugin repos. If we want to offer private repo creation, we need `repo` (which grants broad access to all user repos -- a trust concern).

**Recommendation:** Start with `public_repo`. Add `repo` as an opt-in "advanced" option later if users request private repos.

### 3. Can we use the Contents API to create multiple files, or do we need the Git Data API?

**Both work, but the Git Data API is strongly preferred for our use case.**

| Approach | How it works | Limitations |
|----------|-------------|-------------|
| **Contents API** (`PUT /repos/{owner}/{repo}/contents/{path}`) | Creates/updates one file per API call | Each call creates a separate commit. For 5 files = 5 commits. Cannot create multiple files atomically. |
| **Git Data API** (create tree + commit) | Creates all files in a single atomic commit | More API calls (1 tree + 1 commit + 1 ref update), but produces a clean single-commit result. |

**Recommendation:** Use the Git Data API. A `.claude-plugin/` directory has ~5 files. We want one clean initial commit, not 5 separate commits.

**Simplified flow for a fresh repo** (which is auto-initialized with `auto_init: true`):
1. `POST /repos/{owner}/{repo}/git/trees` -- create a tree with all files, using `content` field directly (no need to create blobs separately)
2. `POST /repos/{owner}/{repo}/git/commits` -- create a commit pointing to that tree, with the default branch's HEAD as parent
3. `PATCH /repos/{owner}/{repo}/git/refs/heads/main` -- update the branch to point to the new commit

### 4. What happens if the repo name already exists?

GitHub returns **HTTP 422 Unprocessable Entity** with:
```json
{
  "message": "Repository creation failed.",
  "errors": [{ "resource": "Repository", "code": "custom", "field": "name", "message": "name already exists on this account" }]
}
```

**Handling strategy:** Check for 422 + "name already exists" error. Present the user with options:
- Choose a different name (e.g., append `-v2`)
- Push to the existing repo (after confirmation)

### 5. Do GitHub OAuth tokens expire?

**Effectively no, for OAuth Apps.** GitHub OAuth App tokens (the classic kind used by Auth.js) do not have a fixed expiration time. They are revoked only when:
- The user revokes access in their GitHub settings
- The token is unused for **1 year** (automatic revocation)
- The token is accidentally pushed to a public repo/gist (automatic revocation)

There is **no refresh token mechanism** for OAuth Apps (only for GitHub Apps). This is actually simpler for us -- the token obtained at login remains valid indefinitely as long as the user doesn't revoke it.

**Implication:** We do not need token refresh logic. The token captured in the `jwt` callback at first login will work for the entire session and future sessions.

---

## Auth.js v5 Configuration

### Environment Variables

```env
AUTH_SECRET=<random-32-char-string>     # Required by Auth.js
AUTH_GITHUB_ID=<github-oauth-app-id>    # From GitHub Developer Settings
AUTH_GITHUB_SECRET=<github-oauth-secret> # From GitHub Developer Settings
```

### GitHub OAuth App Setup

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Set:
   - **Application name:** BotCamp
   - **Homepage URL:** `http://localhost:3000` (dev) / production URL
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Client Secret into env vars

### Auth Configuration

See `example-auth-config.ts` for the complete configuration with:
- GitHub provider with `public_repo` scope
- JWT callback to capture the access token
- Session callback to expose the token to client components
- TypeScript module augmentation for type safety

### Callback URL

Next.js: `https://<domain>/api/auth/callback/github`

---

## GitHub API Flow: Create Repo + Push Files

### Step 1: Create Repository

```
POST /user/repos
Authorization: Bearer <user-access-token>

{
  "name": "my-claude-plugin",
  "description": "Claude plugin created with BotCamp",
  "private": false,
  "auto_init": true
}
```

`auto_init: true` creates the repo with an initial commit (empty README), which gives us a base tree and ref to work with.

### Step 2: Get Default Branch HEAD

```
GET /repos/{owner}/{repo}/git/ref/heads/main
```

Returns the SHA of the current HEAD commit.

### Step 3: Create Tree with All Plugin Files

```
POST /repos/{owner}/{repo}/git/trees
Authorization: Bearer <user-access-token>

{
  "base_tree": "<head-commit-tree-sha>",
  "tree": [
    {
      "path": ".claude-plugin/manifest.json",
      "mode": "100644",
      "type": "blob",
      "content": "{\"name\": \"my-plugin\", ...}"
    },
    {
      "path": ".claude-plugin/hooks/pre-tool-use.ts",
      "mode": "100644",
      "type": "blob",
      "content": "// hook implementation..."
    },
    {
      "path": "README.md",
      "mode": "100644",
      "type": "blob",
      "content": "# My Claude Plugin\n\nCreated with BotCamp."
    }
  ]
}
```

Key: Use the `content` field directly instead of creating blobs first. GitHub creates the blob objects automatically. This reduces the number of API calls from (N blobs + 1 tree) to just 1 tree call.

### Step 4: Create Commit

```
POST /repos/{owner}/{repo}/git/commits
Authorization: Bearer <user-access-token>

{
  "message": "Initial plugin structure from BotCamp",
  "tree": "<new-tree-sha>",
  "parents": ["<head-commit-sha>"]
}
```

### Step 5: Update Branch Reference

```
PATCH /repos/{owner}/{repo}/git/refs/heads/main
Authorization: Bearer <user-access-token>

{
  "sha": "<new-commit-sha>"
}
```

### Complete Flow Summary

```
User clicks "Export to GitHub"
  |
  +-> POST /user/repos (create repo with auto_init)
  +-> GET /repos/{owner}/{repo}/git/ref/heads/main (get HEAD SHA)
  +-> GET /repos/{owner}/{repo}/git/commits/{sha} (get tree SHA)
  +-> POST /repos/{owner}/{repo}/git/trees (create tree with all files)
  +-> POST /repos/{owner}/{repo}/git/commits (create commit)
  +-> PATCH /repos/{owner}/{repo}/git/refs/heads/main (update ref)
  |
  +-> Return repo URL to user
```

Total API calls: 6. All sequential (each depends on the previous). Should complete in under 2 seconds.

---

## Rate Limits

- **Authenticated requests:** 5,000/hour per user token
- **Repo creation:** No specific sub-limit documented, but GitHub may throttle if creating repos rapidly. For our use case (one repo per export), this is a non-issue.
- **Contents/Git Data API:** Covered under the 5,000/hour general limit

---

## Gotchas and Limitations

1. **Scope escalation concern:** `repo` scope grants access to ALL user repos (read/write), not just repos created by our app. Users may hesitate. Stick with `public_repo` initially.

2. **No incremental scope request:** Auth.js does not natively support requesting additional scopes after initial login. If a user logs in with `public_repo` and later wants private repos, they need to re-authenticate with the broader `repo` scope. This can be handled by redirecting to the GitHub authorize URL with the new scope.

3. **Rate limit on tree content:** The `content` field in the tree API has an undocumented size limit. For very large files, create blobs first and reference by SHA. For plugin files (small JSON/TS files), `content` is fine.

4. **Repo name validation:** GitHub repo names must match `[a-zA-Z0-9._-]+` and be unique per user. Validate client-side before the API call.

5. **Auto-init delay:** After creating a repo with `auto_init: true`, there may be a brief delay before the default branch ref is available. Add a short retry (1-2 attempts) on the `GET /git/ref/heads/main` call.

6. **Auth.js session strategy:** Use JWT strategy (default). Do NOT use database sessions unless you also persist the access token in the database. JWT keeps the token in an encrypted cookie, which is simpler.

---

## Architecture Decision

For BotCamp, the recommended architecture:

```
src/
  auth.ts                    # Auth.js config (GitHub provider + token callbacks)
  app/
    api/auth/[...nextauth]/
      route.ts               # Auth.js route handler
    api/github/
      create-repo/
        route.ts             # Server Action: create repo + push files
  lib/
    github.ts                # GitHub API wrapper (create repo, push files)
```

The `create-repo` route handler (or Server Action) receives the plugin files from the client, calls the GitHub API using the user's token from the session, and returns the repo URL. All GitHub API calls happen server-side -- the access token never reaches the browser.

---

## References

- [Auth.js v5 Documentation](https://authjs.dev/)
- [Auth.js GitHub Provider](https://authjs.dev/getting-started/providers/github)
- [Auth.js Migration to v5](https://authjs.dev/getting-started/migrating-to-v5)
- [Auth.js Integrating Third Party Backends](https://authjs.dev/guides/integrating-third-party-backends)
- [GitHub REST API: Create Repository](https://docs.github.com/en/rest/repos/repos)
- [GitHub REST API: Git Trees](https://docs.github.com/en/rest/git/trees)
- [GitHub REST API: Git Database Guide](https://docs.github.com/en/rest/guides/getting-started-with-the-git-database-api)
- [GitHub Token Expiration](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation)
