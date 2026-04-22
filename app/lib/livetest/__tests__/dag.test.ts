import { describe, it, expect } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { transitiveDescendants, transitiveAncestors, directParents } from '../dag';

const node = (id: string, type: string = 'agent'): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { name: id },
});

const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

describe('transitiveDescendants', () => {
  it('returns empty set for a leaf node', () => {
    const edges = [edge('e1', 'a', 'b')];
    expect([...transitiveDescendants('b', edges)]).toEqual([]);
  });

  it('walks a linear chain forward', () => {
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c'), edge('e3', 'c', 'd')];
    expect([...transitiveDescendants('a', edges)].sort()).toEqual(['b', 'c', 'd']);
  });

  it('includes both branches of a fork', () => {
    // a → b → d, a → c → d  (diamond)
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'a', 'c'), edge('e3', 'b', 'd'), edge('e4', 'c', 'd')];
    expect([...transitiveDescendants('a', edges)].sort()).toEqual(['b', 'c', 'd']);
  });

  it('does NOT include sibling branches unrelated to start', () => {
    // a → b; c → d.  Editing a should NOT invalidate d.
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'c', 'd')];
    expect([...transitiveDescendants('a', edges)]).toEqual(['b']);
    expect([...transitiveDescendants('c', edges)]).toEqual(['d']);
  });

  it('handles cycles without infinite loop', () => {
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')];
    expect([...transitiveDescendants('a', edges)]).toEqual(['b']);
  });

  it('excludes the start node itself', () => {
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')];
    expect(transitiveDescendants('a', edges).has('a')).toBe(false);
  });
});

describe('transitiveAncestors', () => {
  it('walks backward through a chain', () => {
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')];
    expect([...transitiveAncestors('c', edges)].sort()).toEqual(['a', 'b']);
  });

  it('captures both parents of a convergence node', () => {
    // a → c, b → c
    const edges = [edge('e1', 'a', 'c'), edge('e2', 'b', 'c')];
    expect([...transitiveAncestors('c', edges)].sort()).toEqual(['a', 'b']);
  });
});

describe('directParents', () => {
  it('returns parents whose outgoing edge targets the node', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('e1', 'a', 'c'), edge('e2', 'b', 'c')];
    const parents = directParents('c', edges, nodes);
    expect(parents.map(p => p.id).sort()).toEqual(['a', 'b']);
  });

  it('filters by node type when requested', () => {
    const nodes = [node('a', 'agent'), node('s', 'skill'), node('c', 'command')];
    const edges = [edge('e1', 'a', 'c'), edge('e2', 's', 'c')];
    const agentParents = directParents('c', edges, nodes, 'agent');
    expect(agentParents.map(p => p.id)).toEqual(['a']);
  });

  it('returns empty for a root node', () => {
    const nodes = [node('a')];
    expect(directParents('a', [], nodes)).toEqual([]);
  });
});
