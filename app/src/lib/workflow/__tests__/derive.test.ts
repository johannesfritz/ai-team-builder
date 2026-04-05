import { describe, it, expect } from 'vitest';
import { deriveWorkflow, getCommandNodes } from '../derive';
import type { Node, Edge } from '@xyflow/react';

function makeNode(id: string, type: string, data: Record<string, unknown>): Node {
  return { id, type, position: { x: 0, y: 0 }, data };
}

describe('deriveWorkflow', () => {
  it('returns empty for non-existent command', () => {
    const result = deriveWorkflow('missing', [], []);
    expect(result).toHaveLength(0);
  });

  it('returns entry step for standalone command', () => {
    const nodes = [makeNode('c1', 'command', { name: 'review', description: 'Code review', prompt: 'Review code.' })];
    const result = deriveWorkflow('c1', nodes, []);
    expect(result).toHaveLength(1);
    expect(result[0].phase).toBe('entry');
    expect(result[0].name).toBe('/review');
  });

  it('includes connected rules in setup phase', () => {
    const nodes = [
      makeNode('r1', 'rule', { name: 'standards', pathFilter: '', content: 'Follow standards.' }),
      makeNode('h1', 'hook', { event: 'PreToolUse', matcher: 'Edit', once: false }),
      makeNode('c1', 'command', { name: 'review', prompt: 'Review.' }),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'h1', target: 'r1' },
      { id: 'e2', source: 'r1', target: 'c1' },
    ];
    const result = deriveWorkflow('c1', nodes, edges);
    const setupSteps = result.filter(s => s.phase === 'setup');
    expect(setupSteps.length).toBeGreaterThan(0);
  });

  it('includes global rules (unconnected, no path filter)', () => {
    const nodes = [
      makeNode('r1', 'rule', { name: 'global-rule', pathFilter: '', content: 'Always loaded.' }),
      makeNode('c1', 'command', { name: 'review', prompt: 'Review.' }),
    ];
    const result = deriveWorkflow('c1', nodes, []);
    const globalSteps = result.filter(s => s.isGlobal);
    expect(globalSteps).toHaveLength(1);
    expect(globalSteps[0].name).toBe('global-rule');
  });

  it('does NOT include unconnected rules with path filter as global', () => {
    const nodes = [
      makeNode('r1', 'rule', { name: 'scoped-rule', pathFilter: '**/*.py', content: 'Python only.' }),
      makeNode('c1', 'command', { name: 'review', prompt: 'Review.' }),
    ];
    const result = deriveWorkflow('c1', nodes, []);
    const globalSteps = result.filter(s => s.isGlobal);
    expect(globalSteps).toHaveLength(0);
  });

  it('includes connected hooks in trigger phase', () => {
    const nodes = [
      makeNode('h1', 'hook', { event: 'PreToolUse', matcher: 'Edit', once: false }),
      makeNode('c1', 'command', { name: 'review', prompt: 'Review.' }),
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'h1', target: 'c1' }];
    const result = deriveWorkflow('c1', nodes, edges);
    const triggerSteps = result.filter(s => s.phase === 'trigger');
    expect(triggerSteps).toHaveLength(1);
  });

  it('handles circular edges without infinite loop', () => {
    const nodes = [
      makeNode('r1', 'rule', { name: 'rule-a', content: 'A' }),
      makeNode('h1', 'hook', { event: 'PreToolUse', matcher: 'Edit', once: false }),
      makeNode('c1', 'command', { name: 'cmd', prompt: 'Do stuff.' }),
    ];
    // Create a cycle: h1 → r1, r1 → h1 (via edges targeting each other)
    const edges: Edge[] = [
      { id: 'e1', source: 'h1', target: 'r1' },
      { id: 'e2', source: 'r1', target: 'h1' },
      { id: 'e3', source: 'h1', target: 'c1' },
    ];
    // Should complete without infinite loop
    const result = deriveWorkflow('c1', nodes, edges);
    expect(result.length).toBeGreaterThan(0);
    // Entry step should always be present
    expect(result.find(s => s.phase === 'entry')).toBeDefined();
  });

  it('extracts internal workflow from command with markdown headings', () => {
    const nodes = [makeNode('c1', 'command', {
      name: 'deploy',
      prompt: '## Build\nRun the build.\n\n## Test\nRun tests.\n\n## Ship\nDeploy to prod.',
    })];
    const result = deriveWorkflow('c1', nodes, []);
    // Should have internal steps + entry
    const executeSteps = result.filter(s => s.phase === 'execute');
    expect(executeSteps.length).toBeGreaterThanOrEqual(3);
  });
});

describe('getCommandNodes', () => {
  it('filters only command nodes', () => {
    const nodes = [
      makeNode('r1', 'rule', { name: 'rule' }),
      makeNode('c1', 'command', { name: 'review' }),
      makeNode('c2', 'command', { name: 'deploy' }),
      makeNode('h1', 'hook', { event: 'PreToolUse' }),
    ];
    const commands = getCommandNodes(nodes);
    expect(commands).toHaveLength(2);
    expect(commands.map(c => c.name)).toEqual(['review', 'deploy']);
  });

  it('returns empty for graph with no commands', () => {
    const nodes = [makeNode('r1', 'rule', { name: 'rule' })];
    expect(getCommandNodes(nodes)).toHaveLength(0);
  });

  it('uses "untitled" for commands without name', () => {
    const nodes = [makeNode('c1', 'command', {})];
    expect(getCommandNodes(nodes)[0].name).toBe('untitled');
  });
});
