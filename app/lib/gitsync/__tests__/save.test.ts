import { describe, it, expect, vi } from 'vitest';
import { saveToConnectedRepo, detectPluginRoot } from '../save';
import type { RepoConnection } from '../types';

const connection: RepoConnection = {
  owner: 'jf',
  repo: 'test',
  branch: 'main',
  lastFetchedSha: 'sha-old',
  pluginRoot: '.claude-plugin',
  loadedAt: 0,
  loadedFileMap: {
    'agents/a.md': 'old content',
    'rules/r.md': 'old rule',
  },
};

function mockFetch(responses: Array<{ status?: number; body?: unknown; ok?: boolean }>) {
  let i = 0;
  return vi.fn(async (_url: string | URL, _init?: RequestInit) => {
    const r = responses[i++] ?? { status: 500, body: { error: 'no more mocks' } };
    return {
      ok: r.ok ?? (r.status ? r.status < 400 : true),
      status: r.status ?? 200,
      statusText: 'OK',
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    } as unknown as Response;
  });
}

describe('saveToConnectedRepo', () => {
  it('short-circuits with ok when file map is identical (no diff)', async () => {
    const fetchImpl = mockFetch([]);
    const result = await saveToConnectedRepo({
      token: 'tok',
      connection,
      newFileMap: { 'agents/a.md': 'old content', 'rules/r.md': 'old rule' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns stale_sha when server HEAD differs from lastFetchedSha', async () => {
    const fetchImpl = mockFetch([
      { body: { object: { sha: 'sha-new-by-someone-else' } } }, // step 1
    ]);
    const result = await saveToConnectedRepo({
      token: 'tok',
      connection,
      newFileMap: { 'agents/a.md': 'new content', 'rules/r.md': 'old rule' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('stale_sha');
      expect(result.serverHeadSha).toBe('sha-new-by-someone-else');
    }
  });

  it('completes 5-step sequence on happy path', async () => {
    const fetchImpl = mockFetch([
      { body: { object: { sha: 'sha-old' } } },      // step 1: ref
      { body: { tree: { sha: 'tree-old' } } },       // step 2: commit
      { body: { sha: 'tree-new' } },                  // step 3: tree
      { body: { sha: 'commit-new' } },                // step 4: commit
      { body: { ref: 'refs/heads/main', object: { sha: 'commit-new' } } }, // step 5: patch
    ]);
    const result = await saveToConnectedRepo({
      token: 'tok',
      connection,
      newFileMap: { 'agents/a.md': 'new content', 'rules/r.md': 'old rule' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newCommitSha).toBe('commit-new');
      expect(result.commitUrl).toContain('commit-new');
    }
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('surfaces 409 on ref PATCH as stale_sha (mid-save race)', async () => {
    const fetchImpl = mockFetch([
      { body: { object: { sha: 'sha-old' } } },
      { body: { tree: { sha: 'tree-old' } } },
      { body: { sha: 'tree-new' } },
      { body: { sha: 'commit-new' } },
      { status: 409, ok: false, body: { message: 'Update is not a fast forward' } },
    ]);
    const result = await saveToConnectedRepo({
      token: 'tok',
      connection,
      newFileMap: { 'agents/a.md': 'new content', 'rules/r.md': 'old rule' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('stale_sha');
  });

  it('sends deletions with sha: null', async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const responses = [
        { body: { object: { sha: 'sha-old' } } },
        { body: { tree: { sha: 'tree-old' } } },
        { body: { sha: 'tree-new' } },
        { body: { sha: 'commit-new' } },
        { body: { ref: 'refs/heads/main' } },
      ];
      const r = responses[calls.length];
      const parsedBody = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ url: url.toString(), body: parsedBody });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => r.body,
        text: async () => JSON.stringify(r.body),
      } as unknown as Response;
    });

    await saveToConnectedRepo({
      token: 'tok',
      connection,
      newFileMap: { 'rules/r.md': 'old rule' },  // deleted agents/a.md
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const treeCall = calls.find(c => c.url.includes('/git/trees') && c.body);
    expect(treeCall).toBeDefined();
    const tree = (treeCall!.body as { tree: Array<{ path: string; sha: unknown }> }).tree;
    const deletion = tree.find(e => e.path.endsWith('agents/a.md'));
    expect(deletion).toBeDefined();
    expect(deletion!.sha).toBeNull();
  });

  it('applies pluginRoot prefix to all paths', async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const responses = [
        { body: { object: { sha: 'sha-old' } } },
        { body: { tree: { sha: 'tree-old' } } },
        { body: { sha: 'tree-new' } },
        { body: { sha: 'commit-new' } },
        { body: { ref: 'refs/heads/main' } },
      ];
      const r = responses[calls.length];
      const parsedBody = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ url: url.toString(), body: parsedBody });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => r.body,
        text: async () => JSON.stringify(r.body),
      } as unknown as Response;
    });

    await saveToConnectedRepo({
      token: 'tok',
      connection,
      newFileMap: { 'agents/a.md': 'new content', 'rules/r.md': 'old rule' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const treeCall = calls.find(c => c.url.includes('/git/trees'));
    const tree = (treeCall!.body as { tree: Array<{ path: string }> }).tree;
    // pluginRoot is '.claude-plugin', so paths should be prefixed
    expect(tree[0].path).toMatch(/^\.claude-plugin\//);
  });
});

describe('detectPluginRoot', () => {
  it('returns .claude-plugin for standard layout', () => {
    expect(detectPluginRoot(['.claude-plugin/plugin.json', '.claude-plugin/agents/a.md'])).toBe('.claude-plugin');
  });
  it('returns empty string for root-level layout', () => {
    expect(detectPluginRoot(['plugin.json', 'agents/a.md'])).toBe('');
  });
  it('returns empty string for implicit root-level (has plugin dirs, no plugin.json)', () => {
    expect(detectPluginRoot(['agents/a.md', 'rules/r.md'])).toBe('');
  });
  it('returns null when neither layout matches', () => {
    expect(detectPluginRoot(['README.md', 'LICENSE'])).toBeNull();
  });
});
