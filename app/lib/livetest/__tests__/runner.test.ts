import { describe, it, expect } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { topoOrderFrom } from '../runner';

const node = (id: string, type: string = 'agent'): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { name: id },
});
const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

describe('topoOrderFrom', () => {
  it('returns single node for a lone agent', () => {
    const nodes = [node('a')];
    expect(topoOrderFrom('a', nodes, [])).toEqual(['a']);
  });

  it('orders a linear chain forward', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')];
    expect(topoOrderFrom('a', nodes, edges)).toEqual(['a', 'b', 'c']);
  });

  it('handles diamond DAG (both branches before convergence)', () => {
    // a → b → d, a → c → d
    const nodes = [node('a'), node('b'), node('c'), node('d')];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'a', 'c'), edge('e3', 'b', 'd'), edge('e4', 'c', 'd')];
    const result = topoOrderFrom('a', nodes, edges);
    // a first, d last, b and c between in some order
    expect(result[0]).toBe('a');
    expect(result[result.length - 1]).toBe('d');
    expect(result.indexOf('b')).toBeLessThan(result.indexOf('d'));
    expect(result.indexOf('c')).toBeLessThan(result.indexOf('d'));
  });

  it('excludes non-agent successors (stops at skill boundary)', () => {
    const nodes = [node('a'), node('s1', 'skill'), node('c1', 'command')];
    const edges = [edge('e1', 'a', 's1'), edge('e2', 's1', 'c1')];
    expect(topoOrderFrom('a', nodes, edges)).toEqual(['a']);
  });
});
