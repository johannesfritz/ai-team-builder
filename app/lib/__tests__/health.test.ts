import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { analyzeHealth } from '../health';

function makeNode(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

describe('analyzeHealth', () => {
  it('returns healthy for a well-formed graph', () => {
    const nodes: Node[] = [
      makeNode('h1', 'hook', { event: 'PreToolUse', matcher: 'Edit', action: '' }),
      makeNode('r1', 'rule', { name: 'my-rule', pathFilter: '**/*.ts', content: 'short' }),
      makeNode('c1', 'command', { name: 'review', prompt: 'Review code' }),
    ];
    const edges: Edge[] = [makeEdge('h1', 'r1')];

    const report = analyzeHealth(nodes, edges);
    expect(report.score).toBe('healthy');
    expect(report.issues).toHaveLength(0);
  });

  it('warns about orphaned hooks with no outgoing edges', () => {
    const nodes: Node[] = [
      makeNode('h1', 'hook', { event: 'PreToolUse', matcher: 'Edit', action: '' }),
      makeNode('c1', 'command', { name: 'test', prompt: 'test' }),
    ];
    const edges: Edge[] = [];

    const report = analyzeHealth(nodes, edges);
    expect(report.score).toBe('warnings');
    const hookIssue = report.issues.find(i => i.nodeId === 'h1');
    expect(hookIssue).toBeDefined();
    expect(hookIssue!.severity).toBe('warning');
    expect(hookIssue!.message).toContain('no connections');
  });

  it('warns about heavy rules without path filter', () => {
    const longContent = 'x'.repeat(2100); // > 500 tokens (2100/4 = 525)
    const nodes: Node[] = [
      makeNode('r1', 'rule', { name: 'heavy-rule', pathFilter: '', content: longContent }),
      makeNode('c1', 'command', { name: 'test', prompt: 'test' }),
    ];
    const edges: Edge[] = [];

    const report = analyzeHealth(nodes, edges);
    const ruleIssue = report.issues.find(i => i.nodeId === 'r1');
    expect(ruleIssue).toBeDefined();
    expect(ruleIssue!.severity).toBe('warning');
    expect(ruleIssue!.message).toContain('tokens');
    expect(ruleIssue!.message).toContain('no path filter');
  });

  it('does not warn about heavy rules WITH path filter', () => {
    const longContent = 'x'.repeat(2100);
    const nodes: Node[] = [
      makeNode('r1', 'rule', { name: 'scoped-rule', pathFilter: '**/*.py', content: longContent }),
      makeNode('c1', 'command', { name: 'test', prompt: 'test' }),
    ];
    const edges: Edge[] = [];

    const report = analyzeHealth(nodes, edges);
    const ruleIssue = report.issues.find(i => i.nodeId === 'r1');
    expect(ruleIssue).toBeUndefined();
  });

  it('reports info for unrestricted agents', () => {
    const nodes: Node[] = [
      makeNode('a1', 'agent', { name: 'open-agent', allowedTools: [] }),
      makeNode('c1', 'command', { name: 'test', prompt: 'test' }),
    ];
    const edges: Edge[] = [];

    const report = analyzeHealth(nodes, edges);
    const agentIssue = report.issues.find(i => i.nodeId === 'a1');
    expect(agentIssue).toBeDefined();
    expect(agentIssue!.severity).toBe('info');
    expect(agentIssue!.message).toContain('no tool restrictions');
  });

  it('does not report agents with allowed tools', () => {
    const nodes: Node[] = [
      makeNode('a1', 'agent', { name: 'safe-agent', allowedTools: ['Read', 'Grep'] }),
      makeNode('c1', 'command', { name: 'test', prompt: 'test' }),
    ];
    const edges: Edge[] = [];

    const report = analyzeHealth(nodes, edges);
    const agentIssue = report.issues.find(i => i.nodeId === 'a1');
    expect(agentIssue).toBeUndefined();
  });

  it('warns when no commands exist', () => {
    const nodes: Node[] = [
      makeNode('r1', 'rule', { name: 'my-rule', pathFilter: '', content: 'short' }),
    ];
    const edges: Edge[] = [];

    const report = analyzeHealth(nodes, edges);
    const cmdIssue = report.issues.find(i => i.message.includes('No commands'));
    expect(cmdIssue).toBeDefined();
    expect(cmdIssue!.severity).toBe('warning');
  });

  it('does not warn about no commands on empty graph', () => {
    const report = analyzeHealth([], []);
    expect(report.score).toBe('healthy');
    expect(report.issues).toHaveLength(0);
  });

  it('detects cycles in the edge graph', () => {
    const nodes: Node[] = [
      makeNode('a', 'hook', { event: 'PreToolUse', matcher: '' }),
      makeNode('b', 'rule', { name: 'r1', content: '' }),
      makeNode('c', 'skill', { name: 's1' }),
    ];
    const edges: Edge[] = [
      makeEdge('a', 'b'),
      makeEdge('b', 'c'),
      makeEdge('c', 'a'),
    ];

    const report = analyzeHealth(nodes, edges);
    expect(report.score).toBe('issues');
    const cycleIssue = report.issues.find(i => i.message.includes('Cycle'));
    expect(cycleIssue).toBeDefined();
    expect(cycleIssue!.severity).toBe('error');
  });

  it('does not report cycles for acyclic graphs', () => {
    const nodes: Node[] = [
      makeNode('a', 'hook', { event: 'PreToolUse', matcher: '' }),
      makeNode('b', 'rule', { name: 'r1', content: '' }),
      makeNode('c1', 'command', { name: 'test', prompt: 'test' }),
    ];
    const edges: Edge[] = [makeEdge('a', 'b')];

    const report = analyzeHealth(nodes, edges);
    const cycleIssue = report.issues.find(i => i.message.includes('Cycle'));
    expect(cycleIssue).toBeUndefined();
  });
});
