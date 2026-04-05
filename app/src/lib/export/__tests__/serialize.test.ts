import { describe, it, expect } from 'vitest';
import { serializeGraph } from '../serialize';
import type { Node, Edge } from '@xyflow/react';

function makeNode(id: string, type: string, data: Record<string, unknown>): Node {
  return { id, type, position: { x: 0, y: 0 }, data };
}

describe('serializeGraph', () => {
  it('produces plugin.json for empty graph', () => {
    const result = serializeGraph([], []);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('plugin.json');
    expect(result.errors).toHaveLength(0);
    expect(result.tokenEstimate).toBe(0);
  });

  it('serializes a rule node to rules/*.md', () => {
    const nodes = [makeNode('r1', 'rule', { name: 'code-standards', pathFilter: '', content: '# Standards\nUse TypeScript.' })];
    const result = serializeGraph(nodes, []);
    const ruleFile = result.files.find(f => f.path === 'rules/code-standards.md');
    expect(ruleFile).toBeDefined();
    expect(ruleFile!.content).toContain('# Standards');
    expect(result.errors).toHaveLength(0);
  });

  it('adds frontmatter for rules with path filter', () => {
    const nodes = [makeNode('r1', 'rule', { name: 'py-rules', pathFilter: '**/*.py', content: 'Python rules' })];
    const result = serializeGraph(nodes, []);
    const ruleFile = result.files.find(f => f.path === 'rules/py-rules.md');
    expect(ruleFile!.content).toContain('paths:');
    expect(ruleFile!.content).toContain('**/*.py');
  });

  it('serializes a skill node to skills/*/SKILL.md', () => {
    const nodes = [makeNode('s1', 'skill', {
      name: 'run-tests', description: 'Run the test suite', instructions: 'npm test',
      filePattern: '**/*.test.ts', bashPattern: '',
    })];
    const result = serializeGraph(nodes, []);
    const skillFile = result.files.find(f => f.path === 'skills/run-tests/SKILL.md');
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toContain('description: "Run the test suite"');
    expect(skillFile!.content).toContain('npm test');
  });

  it('serializes a command node to commands/*.md', () => {
    const nodes = [makeNode('c1', 'command', { name: 'review', prompt: 'Review the code for issues.' })];
    const result = serializeGraph(nodes, []);
    const cmdFile = result.files.find(f => f.path === 'commands/review.md');
    expect(cmdFile).toBeDefined();
    expect(cmdFile!.content).toBe('Review the code for issues.');
  });

  it('serializes an agent node to agents/*.md', () => {
    const nodes = [makeNode('a1', 'agent', {
      name: 'reviewer', model: 'sonnet', systemPrompt: 'You review code.',
      allowedTools: ['Read', 'Grep'],
    })];
    const result = serializeGraph(nodes, []);
    const agentFile = result.files.find(f => f.path === 'agents/reviewer.md');
    expect(agentFile).toBeDefined();
    expect(agentFile!.content).toContain('**Model:** sonnet');
    expect(agentFile!.content).toContain('- Read');
    expect(agentFile!.content).toContain('- Grep');
  });

  it('collects hooks into hooks/hooks.json', () => {
    const nodes = [makeNode('h1', 'hook', { event: 'PreToolUse', matcher: 'Edit', action: 'echo check', once: false })];
    const result = serializeGraph(nodes, []);
    const hooksFile = result.files.find(f => f.path === 'hooks/hooks.json');
    expect(hooksFile).toBeDefined();
    const parsed = JSON.parse(hooksFile!.content);
    expect(parsed.PreToolUse).toHaveLength(1);
    expect(parsed.PreToolUse[0].matcher).toBe('Edit');
  });

  it('auto-generates hook action from connected rule', () => {
    const nodes = [
      makeNode('h1', 'hook', { event: 'PreToolUse', matcher: 'Edit', action: '', once: false }),
      makeNode('r1', 'rule', { name: 'standards', content: 'Follow standards.' }),
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'h1', target: 'r1' }];
    const result = serializeGraph(nodes, edges);
    const hooksFile = result.files.find(f => f.path === 'hooks/hooks.json');
    const parsed = JSON.parse(hooksFile!.content);
    expect(parsed.PreToolUse[0].hooks[0].command).toContain('rules/standards.md');
  });

  it('collects MCP configs into .mcp.json', () => {
    const nodes = [makeNode('m1', 'mcp', { serverName: 'my-api', command: 'node', args: ['dist/server.js'], env: { API_KEY: 'test' } })];
    const result = serializeGraph(nodes, []);
    const mcpFile = result.files.find(f => f.path === '.mcp.json');
    expect(mcpFile).toBeDefined();
    const parsed = JSON.parse(mcpFile!.content);
    expect(parsed.mcpServers['my-api'].command).toBe('node');
    expect(parsed.mcpServers['my-api'].env.API_KEY).toBe('test');
  });

  it('reports errors for nodes with missing required fields', () => {
    const nodes = [
      makeNode('r1', 'rule', { name: '', label: 'My Rule', content: 'content' }),
      makeNode('c1', 'command', { name: '', label: 'My Cmd', prompt: 'do stuff' }),
    ];
    const result = serializeGraph(nodes, []);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('Rule');
    expect(result.errors[1]).toContain('Command');
  });

  it('estimates tokens across all nodes', () => {
    const nodes = [
      makeNode('r1', 'rule', { name: 'test', content: 'a'.repeat(100) }),
      makeNode('c1', 'command', { name: 'cmd', prompt: 'b'.repeat(200) }),
    ];
    const result = serializeGraph(nodes, []);
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it('uses custom plugin name and version', () => {
    const result = serializeGraph([], [], 'my-tool', '2.0.0', 'A tool');
    const manifest = JSON.parse(result.files[0].content);
    expect(manifest.name).toBe('my-tool');
    expect(manifest.version).toBe('2.0.0');
    expect(manifest.description).toBe('A tool');
  });
});
