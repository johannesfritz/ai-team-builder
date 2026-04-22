// Git Sync — Git Data API save flow.
//
// Per approved design doc: 5-step atomic sequence.
//   1. GET ref (direct)
//   2. GET commit (direct)
//   3. POST tree (proxied, diff-only entries with base_tree)
//   4. POST commit (proxied)
//   5. PATCH ref (proxied, 409 = stale SHA conflict)
//
// Reads (steps 1-2) go direct to api.github.com to avoid proxy bottleneck.
// Writes (steps 3-5) route through the proxy for audit.

import type { RepoConnection, SaveOutcome } from './types';
import { diffFileMaps, buildCommitMessage, type FileMap, type FileMapDiff } from './diff';

export const GITHUB_API = 'https://api.github.com';
export const PROXY_GITHUB_BASE = '/ai-team-builder/api/github';

export interface SaveDeps {
  token: string;
  connection: RepoConnection;
  newFileMap: FileMap;
  // For testing; default to window.fetch.
  fetchImpl?: typeof fetch;
  // Only true when the user explicitly chose "Force overwrite" in the conflict modal.
  force?: boolean;
}

/**
 * Execute the 5-step save sequence. Returns SaveOutcome.
 * On conflict at step 1 or step 5, returns kind: 'stale_sha' with serverHeadSha.
 */
export async function saveToConnectedRepo({
  token,
  connection,
  newFileMap,
  fetchImpl = fetch,
  force = false,
}: SaveDeps): Promise<SaveOutcome> {
  const { owner, repo, branch, lastFetchedSha, loadedFileMap, pluginRoot } = connection;

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };

  // Apply pluginRoot prefix to every new file path.
  const prefixedNew: FileMap = {};
  for (const [k, v] of Object.entries(newFileMap)) {
    prefixedNew[joinPath(pluginRoot, k)] = v;
  }
  const prefixedOld: FileMap = {};
  for (const [k, v] of Object.entries(loadedFileMap ?? {})) {
    prefixedOld[joinPath(pluginRoot, k)] = v;
  }

  const diff = diffFileMaps(prefixedOld, prefixedNew);
  if (diff.added.length === 0 && diff.modified.length === 0 && diff.deleted.length === 0) {
    return { ok: true, newCommitSha: lastFetchedSha, commitUrl: `https://github.com/${owner}/${repo}/commit/${lastFetchedSha}` };
  }

  // Step 1: GET ref (direct)
  const refResp = await fetchImpl(`${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    headers: authHeaders,
  });
  if (!refResp.ok) {
    return failure(refResp, 'unauthorized');
  }
  const refData = (await refResp.json()) as { object?: { sha?: string } };
  const serverHeadSha = refData.object?.sha;
  if (!serverHeadSha) {
    return { ok: false, error: { kind: 'unknown', message: 'ref response missing sha' } };
  }
  if (!force && serverHeadSha !== lastFetchedSha) {
    return {
      ok: false,
      error: { kind: 'stale_sha', message: 'Repo changed since you loaded it' },
      serverHeadSha,
    };
  }

  const baseSha = force ? lastFetchedSha : serverHeadSha;

  // Step 2: GET commit to discover base tree (direct)
  const commitResp = await fetchImpl(`${GITHUB_API}/repos/${owner}/${repo}/git/commits/${baseSha}`, {
    headers: authHeaders,
  });
  if (!commitResp.ok) {
    return failure(commitResp, 'unknown');
  }
  const commitData = (await commitResp.json()) as { tree?: { sha?: string } };
  const baseTreeSha = commitData.tree?.sha;
  if (!baseTreeSha) {
    return { ok: false, error: { kind: 'unknown', message: 'commit response missing tree sha' } };
  }

  // Step 3: POST tree (proxied, diff-only entries)
  const treeEntries = buildTreeEntries(diff, prefixedNew);
  const treeBody = { base_tree: baseTreeSha, tree: treeEntries };
  const treeResp = await fetchImpl(`${PROXY_GITHUB_BASE}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(treeBody),
  });
  if (!treeResp.ok) return failure(treeResp, classifyStatus(treeResp.status));
  const treeData = (await treeResp.json()) as { sha?: string };
  if (!treeData.sha) return { ok: false, error: { kind: 'unknown', message: 'tree response missing sha' } };

  // Step 4: POST commit (proxied)
  const message = buildCommitMessage(diff);
  const commitBody = { message, tree: treeData.sha, parents: [baseSha] };
  const newCommitResp = await fetchImpl(`${PROXY_GITHUB_BASE}/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(commitBody),
  });
  if (!newCommitResp.ok) return failure(newCommitResp, classifyStatus(newCommitResp.status));
  const newCommitData = (await newCommitResp.json()) as { sha?: string };
  if (!newCommitData.sha) return { ok: false, error: { kind: 'unknown', message: 'new commit missing sha' } };

  // Step 5: PATCH ref (proxied; this is where conflict would surface if not force)
  const refPatchBody = { sha: newCommitData.sha, force };
  const patchResp = await fetchImpl(`${PROXY_GITHUB_BASE}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(refPatchBody),
  });
  if (!patchResp.ok) {
    if (patchResp.status === 409 || patchResp.status === 422) {
      return { ok: false, error: { kind: 'stale_sha', message: 'Ref update rejected — repo changed during save' } };
    }
    return failure(patchResp, classifyStatus(patchResp.status));
  }

  return {
    ok: true,
    newCommitSha: newCommitData.sha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitData.sha}`,
  };
}

interface TreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  content?: string;
  sha?: string | null;
}

function buildTreeEntries(diff: FileMapDiff, newMap: FileMap): TreeEntry[] {
  const entries: TreeEntry[] = [];
  for (const p of [...diff.added, ...diff.modified]) {
    entries.push({ path: p, mode: '100644', type: 'blob', content: newMap[p] });
  }
  for (const p of diff.deleted) {
    // Deletion requires sha: null, not omission.
    entries.push({ path: p, mode: '100644', type: 'blob', sha: null });
  }
  return entries;
}

function joinPath(root: string, rel: string): string {
  if (!root) return rel;
  return `${root.replace(/\/$/, '')}/${rel.replace(/^\//, '')}`;
}

function classifyStatus(status: number): SaveOutcome extends { ok: false; error: infer E } ? E extends { kind: infer K } ? K : never : never {
  if (status === 401) return 'unauthorized' as never;
  if (status === 403 || status === 422) return 'branch_protected' as never;
  if (status === 429) return 'rate_limit' as never;
  return 'unknown' as never;
}

async function failure(resp: Response, kind: 'unauthorized' | 'branch_protected' | 'rate_limit' | 'unknown'): Promise<SaveOutcome> {
  let body = '';
  try { body = await resp.text(); } catch { /* noop */ }
  return {
    ok: false,
    error: {
      kind,
      message: `HTTP ${resp.status} ${resp.statusText}${body ? `: ${body.slice(0, 200)}` : ''}`,
      httpStatus: resp.status,
    },
  };
}

/**
 * Detect the plugin root in a file tree response. Returns '' for root-level
 * plugin layout, '.claude-plugin' for standard, or null if neither matches
 * (caller surfaces a warning banner).
 */
export function detectPluginRoot(paths: string[]): string | null {
  if (paths.some(p => p === '.claude-plugin/plugin.json' || p.startsWith('.claude-plugin/'))) {
    return '.claude-plugin';
  }
  if (paths.some(p => p === 'plugin.json' || /^(rules|skills|agents|commands|hooks)\//.test(p))) {
    return '';
  }
  return null;
}
