# ADR-004: Plugin Storage & Distribution — GitHub Repos (Native)

**Status:** Accepted
**Date:** 2026-03-28
**Decision Makers:** Solutions Architect (Claude)

---

## Institutional Memory Check

Related ADRs: None directly related. This is a new domain (plugin distribution).

Consistency Analysis:
- The existing codebase uses GitHub extensively. All 40+ repos are on GitHub. Deploy keys, GitHub Actions, and `gh` CLI are standard tooling. Using GitHub as the distribution channel aligns with existing infrastructure.

---

## Context

Claude Code plugins are installed via:

```bash
claude plugin add <github-repo-url>
```

The plugin package is a `.claude/` directory structure containing hooks, skills, rules, commands, and agent definitions. Plugins are inherently Git-based — they live in repositories and are versioned through Git.

The distribution mechanism must handle:

| Requirement | Details |
|-------------|---------|
| Plugin publishing | Creator pushes a new version |
| Plugin installation | User runs `claude plugin add` |
| Version management | Semantic versioning, rollback |
| Access control | Public vs. private plugins |
| Paid plugins | Must prevent unauthorized access |

---

## Decision

Use **GitHub repositories** as the native storage and distribution mechanism for plugins. Each plugin is a GitHub repo (or a directory within a monorepo) containing the `.claude/` directory structure.

Bot the Builder manages the GitHub integration:
1. **Builder** generates the `.claude/` directory structure from the visual config
2. **Platform** pushes to the user's GitHub repo (via GitHub App)
3. **Marketplace** indexes public repos for discovery
4. **Installation** uses the standard `claude plugin add <repo>` command

---

## Options Considered

### Option A: GitHub Repos (Native) — SELECTED

**Pros:**
- Zero friction with Claude Code's existing plugin install mechanism
- Users already have GitHub accounts (required for Claude Code anyway)
- Versioning via Git tags — semantic versioning is natural
- Pull requests for plugin updates — review before publishing
- GitHub Actions can validate plugin structure on push
- Forking enables community contributions
- Stars/forks provide social proof (supplements marketplace ratings)
- Private repos provide access control for paid plugins (via GitHub App)

**Cons:**
- GitHub API rate limits (5,000 req/hour authenticated)
- Paid plugin access control requires a GitHub App with repo-level permissions
- Users must grant GitHub App access to their account
- No built-in CDN (mitigated: GitHub serves raw content, and plugin packages are small)

### Option B: Custom Git Hosting (Gitea/Forgejo)

**Pros:**
- Full control over access, rate limits, and storage
- No GitHub dependency

**Cons:**
- Massive operational overhead (hosting, backup, scaling)
- Users must create accounts on a separate platform
- Not compatible with `claude plugin add <github-url>` without a proxy
- Reinventing what GitHub already provides

### Option C: S3/Blob Storage (Tarballs)

**Pros:**
- Simple storage model (upload tarball, download tarball)
- No Git complexity
- CDN-friendly

**Cons:**
- Not compatible with `claude plugin add` (expects Git repos)
- No versioning without custom implementation
- No community features (PRs, forks, issues)
- Must build custom access control from scratch

### Option D: npm-style Registry

**Pros:**
- Familiar package manager model
- Versioning built in

**Cons:**
- Not compatible with `claude plugin add` (expects Git repos)
- Must build or host a custom registry
- Plugins are not npm packages — they're config directories

---

## Consequences

### Positive

1. **Native compatibility** — works with `claude plugin add` without modification
2. **Zero hosting cost** — GitHub stores the repos, we just index them
3. **Community features** — PRs, forks, issues, stars come free
4. **Existing tooling** — team already uses GitHub extensively
5. **Versioning** — Git tags provide semantic versioning naturally

### Negative

1. **GitHub dependency** — if GitHub is down, plugin distribution is down
2. **Rate limits** — marketplace indexing must respect GitHub API limits (use webhooks, not polling)
3. **Paid plugin complexity** — access control for paid plugins requires a GitHub App that manages repo collaborator access or uses private repos with deploy keys

### Trade-off

We are coupling to GitHub. This is acceptable because Claude Code itself couples to GitHub for plugin installation. If Anthropic adds alternative distribution channels (npm, custom registries), we can add support. But for MVP, GitHub IS the distribution channel.

---

## Implementation Notes

### GitHub App

Bot the Builder registers a GitHub App that:
1. Creates repos in the user's account (or an org) when publishing a plugin
2. Pushes generated `.claude/` structure on version publish
3. Manages collaborator access for paid plugins (add buyer as collaborator on purchase)
4. Receives webhooks for repo events (push, release, star)

### Paid Plugin Access Control

For paid plugins:
1. Repo is **private** on GitHub
2. On purchase, Bot the Builder's GitHub App adds the buyer as a read-only collaborator
3. Buyer can `claude plugin add <private-repo-url>` (authenticated via their GitHub token)
4. On subscription cancellation, collaborator access is revoked

This is simple but scales to thousands of buyers (GitHub supports up to 5,000 collaborators per repo). For higher scale, consider GitHub Teams or a proxy layer.

### Marketplace Indexing

- On plugin publish: store metadata in PostgreSQL, generate search embeddings
- Periodic sync: verify GitHub repos still exist, update star counts
- Webhook-driven: GitHub webhooks notify on push/release/star events

---

## Related ADRs

- ADR-005: Authentication (GitHub OAuth)
- ADR-006: Payment Processing (purchase triggers collaborator access)
