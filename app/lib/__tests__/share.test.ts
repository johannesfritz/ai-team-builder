import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encodeShareURL, decodeShareURL } from '../share';

describe('share URL encoding/decoding', () => {
  const sampleState = {
    nodes: [{ id: 'r1', type: 'rule', position: { x: 0, y: 0 }, data: { name: 'test', content: 'content' } }],
    edges: [],
    meta: { name: 'test-plugin', description: 'A test' },
  };

  it('round-trips a simple state', async () => {
    const encoded = await encodeShareURL(sampleState, 'https://example.com/builder');
    expect('url' in encoded).toBe(true);
    if (!('url' in encoded)) return;

    const hash = encoded.url.split('#')[1];
    const decoded = await decodeShareURL(hash);
    expect('nodes' in decoded).toBe(true);
    if (!('nodes' in decoded)) return;

    expect(decoded.nodes).toEqual(sampleState.nodes);
    expect(decoded.edges).toEqual(sampleState.edges);
    expect(decoded.meta).toEqual(sampleState.meta);
  });

  it('includes v1 version prefix', async () => {
    const encoded = await encodeShareURL(sampleState, 'https://example.com');
    if (!('url' in encoded)) return;
    expect(encoded.url).toContain('#v1:');
  });

  it('returns error for oversized state without token', async () => {
    const bigState = {
      nodes: Array.from({ length: 200 }, (_, i) => ({
        id: `node-${i}`,
        type: 'rule',
        position: { x: i * 100, y: i * 50 },
        data: { name: `rule-${i}-unique-name-${Math.random()}`, content: Array.from({ length: 200 }, (_, j) => `line-${j}-unique-${Math.random()}`).join('\n') },
      })),
      edges: Array.from({ length: 100 }, (_, i) => ({ id: `e-${i}`, source: `node-${i}`, target: `node-${i+1}` })),
      meta: { name: 'big', description: 'A very large plugin with many nodes' },
    };
    const result = await encodeShareURL(bigState, 'https://example.com');
    expect('error' in result).toBe(true);
  });

  it('returns error for invalid hash', async () => {
    expect('error' in await decodeShareURL('garbage')).toBe(true);
  });

  it('returns error for wrong version', async () => {
    expect('error' in await decodeShareURL('v99:data')).toBe(true);
  });

  it('returns error for corrupted compressed data', async () => {
    expect('error' in await decodeShareURL('v1:notvalidlzstring!!!')).toBe(true);
  });

  it('handles empty hash gracefully', async () => {
    expect('error' in await decodeShareURL('')).toBe(true);
  });

  it('handles hash with # prefix', async () => {
    const encoded = await encodeShareURL(sampleState, 'https://example.com');
    if (!('url' in encoded)) return;
    const hashWithPrefix = '#' + encoded.url.split('#')[1];
    const decoded = await decodeShareURL(hashWithPrefix);
    expect('nodes' in decoded).toBe(true);
  });
});

describe('Gist sharing', () => {
  const sampleState = {
    nodes: [{ id: 'n1', type: 'rule', position: { x: 0, y: 0 }, data: { name: 'test', content: 'x' } }],
    edges: [],
    meta: { name: 'gist-test', description: 'Testing gist path' },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('decodeShareURL handles gist:{id} format', async () => {
    const mockGistResponse = {
      files: {
        'plugin.json': {
          content: JSON.stringify(sampleState),
        },
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGistResponse),
    });

    const result = await decodeShareURL('#gist:abc123def456');
    expect('nodes' in result).toBe(true);
    if (!('nodes' in result)) return;
    expect(result.nodes).toEqual(sampleState.nodes);
    expect(result.meta).toEqual(sampleState.meta);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.github.com/gists/abc123def456',
      expect.objectContaining({ headers: { Accept: 'application/vnd.github+json' } }),
    );
  });

  it('decodeShareURL returns error for failed gist fetch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await decodeShareURL('gist:deadbeef');
    expect('error' in result).toBe(true);
  });

  it('encodeShareURL with oversized state + token triggers gist path', async () => {
    const bigState = {
      nodes: Array.from({ length: 200 }, (_, i) => ({
        id: `node-${i}`,
        type: 'rule',
        position: { x: i * 100, y: i * 50 },
        data: { name: `rule-${i}-name-${Math.random()}`, content: Array.from({ length: 200 }, (_, j) => `line-${j}-${Math.random()}`).join('\n') },
      })),
      edges: [],
      meta: { name: 'big-gist', description: 'Large plugin' },
    };

    // Mock the window object for gist URL construction
    const originalWindow = globalThis.window;
    globalThis.window = { location: { origin: 'https://jfritz.xyz' } } as Window & typeof globalThis;

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'abc123' }),
    });

    const result = await encodeShareURL(bigState, 'https://jfritz.xyz/ai-team-builder/builder', 'fake-token');
    expect('url' in result).toBe(true);
    if (!('url' in result)) return;
    expect(result.url).toContain('#gist:abc123');
    expect(result.method).toBe('gist');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/ai-team-builder/api/github/gists',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-token',
        }),
      }),
    );

    globalThis.window = originalWindow;
  });
});
