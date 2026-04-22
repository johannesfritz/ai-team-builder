// DAG utilities for Live Test.
//
// The workflow graph is a DAG (agents can have parallel branches, e.g. the podcast
// template has script-writer feeding both script-reviewer and podcast-fact-checker).
// Cache invalidation MUST walk transitive descendants, not "all steps with index > N"
// (which would wrongly mark sibling branches stale).

import type { Edge, Node } from '@xyflow/react';

/**
 * Returns the set of nodes reachable by following outgoing edges from startId.
 * The startId itself is NOT included. Cycles are tolerated via the seen set.
 */
export function transitiveDescendants(startId: string, edges: Edge[]): Set<string> {
  const out = new Set<string>();
  const queue: string[] = [startId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (e.source === cur && !out.has(e.target) && e.target !== startId) {
        out.add(e.target);
        queue.push(e.target);
      }
    }
  }
  return out;
}

/**
 * Returns the set of nodes reachable by following incoming edges from endId.
 * The endId itself is NOT included.
 */
export function transitiveAncestors(endId: string, edges: Edge[]): Set<string> {
  const out = new Set<string>();
  const queue: string[] = [endId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (e.target === cur && !out.has(e.source) && e.source !== endId) {
        out.add(e.source);
        queue.push(e.source);
      }
    }
  }
  return out;
}

/**
 * Return the direct parents of nodeId (incoming edges from agents/commands only).
 * Filter by nodeType if provided.
 */
export function directParents(
  nodeId: string,
  edges: Edge[],
  nodes: Node[],
  filterType?: string,
): Node[] {
  const parentIds = edges.filter(e => e.target === nodeId).map(e => e.source);
  const parents = parentIds.map(id => nodes.find(n => n.id === id)).filter((n): n is Node => !!n);
  if (filterType) return parents.filter(n => n.type === filterType);
  return parents;
}
