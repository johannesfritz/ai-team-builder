import { describe, it, expect } from 'vitest';
import { encodeShareURL, decodeShareURL } from '../share';

describe('share URL encoding/decoding', () => {
  const sampleState = {
    nodes: [{ id: 'r1', type: 'rule', position: { x: 0, y: 0 }, data: { name: 'test', content: 'content' } }],
    edges: [],
    meta: { name: 'test-plugin', description: 'A test' },
  };

  it('round-trips a simple state', () => {
    const encoded = encodeShareURL(sampleState, 'https://example.com/builder');
    expect('url' in encoded).toBe(true);
    if (!('url' in encoded)) return;

    const hash = encoded.url.split('#')[1];
    const decoded = decodeShareURL(hash);
    expect('nodes' in decoded).toBe(true);
    if (!('nodes' in decoded)) return;

    expect(decoded.nodes).toEqual(sampleState.nodes);
    expect(decoded.edges).toEqual(sampleState.edges);
    expect(decoded.meta).toEqual(sampleState.meta);
  });

  it('includes v1 version prefix', () => {
    const encoded = encodeShareURL(sampleState, 'https://example.com');
    if (!('url' in encoded)) return;
    expect(encoded.url).toContain('#v1:');
  });

  it('returns error for oversized state', () => {
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
    const result = encodeShareURL(bigState, 'https://example.com');
    expect('error' in result).toBe(true);
  });

  it('returns error for invalid hash', () => {
    expect('error' in decodeShareURL('garbage')).toBe(true);
  });

  it('returns error for wrong version', () => {
    expect('error' in decodeShareURL('v99:data')).toBe(true);
  });

  it('returns error for corrupted compressed data', () => {
    expect('error' in decodeShareURL('v1:notvalidlzstring!!!')).toBe(true);
  });

  it('handles empty hash gracefully', () => {
    expect('error' in decodeShareURL('')).toBe(true);
  });

  it('handles hash with # prefix', () => {
    const encoded = encodeShareURL(sampleState, 'https://example.com');
    if (!('url' in encoded)) return;
    const hashWithPrefix = '#' + encoded.url.split('#')[1];
    const decoded = decodeShareURL(hashWithPrefix);
    expect('nodes' in decoded).toBe(true);
  });
});
