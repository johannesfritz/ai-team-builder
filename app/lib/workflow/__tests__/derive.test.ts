import { describe, it, expect } from 'vitest';
import { deriveWorkflow, getCommandNodes } from '../derive';
import { VALID_CONNECTIONS } from '../../plugin-types';
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

  it('orders chained agents topologically (a→b→c→command), not in node-array order', () => {
    // Insert nodes in REVERSE pipeline order to prove ordering comes from edges, not array position
    const nodes = [
      makeNode('c1', 'command', { name: 'produce', prompt: 'Run pipeline.' }),
      makeNode('a3', 'agent', { name: 'voice-producer', model: 'sonnet', systemPrompt: 'Generate audio.' }),
      makeNode('a2', 'agent', { name: 'script-reviewer', model: 'sonnet', systemPrompt: 'Review the script.' }),
      makeNode('a1', 'agent', { name: 'script-writer', model: 'opus', systemPrompt: 'Write the script.' }),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'a1', target: 'a2' },
      { id: 'e2', source: 'a2', target: 'a3' },
      { id: 'e3', source: 'a3', target: 'c1' },
    ];
    const result = deriveWorkflow('c1', nodes, edges);
    const agentSteps = result.filter(s => s.phase === 'execute' && s.nodeType === 'agent');
    expect(agentSteps.map(s => s.name)).toEqual(['script-writer', 'script-reviewer', 'voice-producer']);
  });

  it('classifies all chained agents as execute phase, even in long chains', () => {
    const nodes: Node[] = [
      ...Array.from({ length: 6 }, (_, i) =>
        makeNode(`a${i + 1}`, 'agent', { name: `agent-${i + 1}`, model: 'sonnet', systemPrompt: 'Do work.' }),
      ),
      makeNode('c1', 'command', { name: 'pipeline', prompt: 'Run pipeline.' }),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'a1', target: 'a2' },
      { id: 'e2', source: 'a2', target: 'a3' },
      { id: 'e3', source: 'a3', target: 'a4' },
      { id: 'e4', source: 'a4', target: 'a5' },
      { id: 'e5', source: 'a5', target: 'a6' },
      { id: 'e6', source: 'a6', target: 'c1' },
    ];
    const result = deriveWorkflow('c1', nodes, edges);
    const agentSteps = result.filter(s => s.nodeType === 'agent');
    expect(agentSteps).toHaveLength(6);
    expect(agentSteps.every(s => s.phase === 'execute')).toBe(true);
  });

  it('validates connections per VALID_CONNECTIONS: accepts agent→agent and agent→command, rejects forbidden', () => {
    // Newly accepted (Sprint 1)
    expect(VALID_CONNECTIONS.agent).toContain('agent');
    expect(VALID_CONNECTIONS.agent).toContain('command');
    expect(VALID_CONNECTIONS.agent).toContain('skill');
    // Existing accepted
    expect(VALID_CONNECTIONS.hook).toEqual(expect.arrayContaining(['rule', 'skill']));
    expect(VALID_CONNECTIONS.skill).toEqual(['command']);
    // Forbidden — terminal node types have no outgoing edges
    expect(VALID_CONNECTIONS.command).toEqual([]);
    expect(VALID_CONNECTIONS.rule).toEqual([]);
    expect(VALID_CONNECTIONS.mcp).toEqual([]);
    // Specifically forbidden — skill→skill stays out until a real example demands it
    expect(VALID_CONNECTIONS.skill).not.toContain('skill');
    // Specifically forbidden — no reverse edges from terminal types
    expect(VALID_CONNECTIONS.command).not.toContain('agent');
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
