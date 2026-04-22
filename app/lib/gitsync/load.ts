// Load a GitHub repo's plugin files into the builder and establish a RepoConnection.

import type { RepoConnection } from './types';
import { detectPluginRoot } from './save';

export const GITHUB_API = 'https://api.github.com';

export interface ParsedRepoUrl {
  owner: string;
  repo: string;
  branch: string;
}

/**
 * Accept a GitHub URL, a plain `owner/repo`, or `owner/repo@branch`.
 * Examples:
 *   https://github.com/johannesfritz/cc-podcast-team
 *   https://github.com/johannesfritz/cc-podcast-team/tree/feature-x
 *   johannesfritz/cc-podcast-team
 *   johannesfritz/cc-podcast-team@main
 */
export function parseRepoUrl(input: string, defaultBranch = 'main'): ParsedRepoUrl | null {
  const s = input.trim();
  if (!s) return null;

  // Full URL
  const urlMatch = s.match(/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:\/tree\/([^/\s]+))?(?:\/|$)/);
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      branch: urlMatch[3] ?? defaultBranch,
    };
  }

  // owner/repo[@branch]
  const slashMatch = s.match(/^([\w.-]+)\/([\w.-]+)(?:@([\w./\-]+))?$/);
  if (slashMatch) {
    return {
      owner: slashMatch[1],
      repo: slashMatch[2],
      branch: slashMatch[3] ?? defaultBranch,
    };
  }

  return null;
}

export interface LoadedRepo {
  connection: RepoConnection;
  files: Array<{ path: string; content: string }>;
}

/**
 * Fetch plugin files from a GitHub repo. Reads the tree + file contents directly
 * (browser → GitHub API with the OAuth token). Detects pluginRoot.
 */
export async function loadRepo(
  parsed: ParsedRepoUrl,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LoadedRepo> {
  const { owner, repo, branch } = parsed;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };

  // 1. Resolve branch HEAD sha.
  const refResp = await fetchImpl(`${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${branch}`, { headers });
  if (!refResp.ok) {
    throw new Error(`Cannot fetch branch ${branch}: HTTP ${refResp.status}`);
  }
  const ref = (await refResp.json()) as { object?: { sha?: string } };
  const headSha = ref.object?.sha;
  if (!headSha) throw new Error('Branch ref response missing sha');

  // 2. Get the tree recursively.
  const treeResp = await fetchImpl(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${headSha}?recursive=1`,
    { headers },
  );
  if (!treeResp.ok) throw new Error(`Cannot fetch tree: HTTP ${treeResp.status}`);
  const treeData = (await treeResp.json()) as {
    tree?: Array<{ path?: string; type?: string; sha?: string }>;
    truncated?: boolean;
  };
  if (treeData.truncated) {
    // We could page, but for plugin-sized repos this is fine; warn and continue.
    if (typeof console !== 'undefined') console.warn('[gitsync] tree truncated — plugin may be too large');
  }
  const allPaths = (treeData.tree ?? []).filter(e => e.type === 'blob' && e.path).map(e => e.path!);

  // 3. Detect pluginRoot.
  const pluginRoot = detectPluginRoot(allPaths);
  if (pluginRoot === null) {
    throw new Error('No plugin.json found in repo (tried .claude-plugin/ and root).');
  }

  // 4. Fetch plugin-relevant files (those under pluginRoot).
  // For Sprint 4 v1 we only fetch files that look like plugin content — filter
  // by extension and known plugin directories to avoid pulling README, LICENSE, etc.
  const relevantPrefix = pluginRoot ? `${pluginRoot}/` : '';
  const pluginFilePaths = allPaths.filter((p) => {
    if (!p.startsWith(relevantPrefix)) return false;
    const rel = p.slice(relevantPrefix.length);
    return (
      rel === 'plugin.json' ||
      /^(rules|skills|agents|commands|hooks)\/.+/.test(rel) ||
      rel === '.mcp.json' ||
      rel === 'CLAUDE.md'
    );
  });

  // Fetch each file in parallel. For a typical plugin that's ~10-20 files.
  const files = await Promise.all(
    pluginFilePaths.map(async (p) => {
      const contentResp = await fetchImpl(
        `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(p)}?ref=${encodeURIComponent(branch)}`,
        { headers },
      );
      if (!contentResp.ok) {
        throw new Error(`Cannot fetch ${p}: HTTP ${contentResp.status}`);
      }
      const d = (await contentResp.json()) as { content?: string; encoding?: string };
      let content = '';
      if (d.encoding === 'base64' && d.content) {
        content = decodeBase64(d.content);
      }
      // Strip pluginRoot prefix from path so downstream parse-plugin expects plugin-relative paths
      const rel = pluginRoot ? p.slice(pluginRoot.length + 1) : p;
      return { path: rel, content };
    }),
  );

  // Build the file map used by the save diff later.
  const loadedFileMap: Record<string, string> = {};
  for (const f of files) loadedFileMap[f.path] = f.content;

  return {
    connection: {
      owner,
      repo,
      branch,
      lastFetchedSha: headSha,
      pluginRoot,
      loadedAt: Date.now(),
      loadedFileMap,
    },
    files,
  };
}

function decodeBase64(s: string): string {
  // GitHub Contents API returns base64 with newlines; atob needs them stripped.
  const clean = s.replace(/\s+/g, '');
  if (typeof atob === 'function') {
    // atob decodes to binary string; convert to UTF-8 via TextDecoder
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  // Node test environment
  return Buffer.from(clean, 'base64').toString('utf-8');
}
