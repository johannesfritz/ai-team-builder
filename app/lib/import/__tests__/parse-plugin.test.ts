import { describe, it, expect } from 'vitest';
import { parsePluginFiles } from '../parse-plugin';

describe('parsePluginFiles', () => {
  it('returns empty result for empty input', () => {
    const result = parsePluginFiles([]);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.warnings).toContain('No plugin components found. Expected files in rules/, skills/, commands/, agents/, or hooks/hooks.json');
  });

  it('parses a rule file', () => {
    const result = parsePluginFiles([
      { path: 'rules/code-standards.md', content: '# Code Standards\nUse TypeScript.' },
    ]);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('rule');
    expect((result.nodes[0].data as { name: string }).name).toBe('code-standards');
  });

  it('parses rule with frontmatter path filter', () => {
    const result = parsePluginFiles([
      { path: 'rules/py-rules.md', content: '---\npaths:\n  - "**/*.py"\n---\n\n# Python Rules' },
    ]);
    expect(result.nodes).toHaveLength(1);
    expect((result.nodes[0].data as { pathFilter: string }).pathFilter).toContain('**/*.py');
  });

  it('parses a skill file', () => {
    const result = parsePluginFiles([
      { path: 'skills/run-tests/SKILL.md', content: '---\ndescription: "Run tests"\nfilePattern: "**/*.test.ts"\n---\n\nRun npm test' },
    ]);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('skill');
    expect((result.nodes[0].data as { name: string }).name).toBe('run-tests');
    expect((result.nodes[0].data as { description: string }).description).toBe('Run tests');
  });

  it('parses a command file', () => {
    const result = parsePluginFiles([
      { path: 'commands/review.md', content: '# Review\nReview the code.' },
    ]);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('command');
    expect((result.nodes[0].data as { name: string }).name).toBe('review');
  });

  it('parses an agent file with structured format', () => {
    const result = parsePluginFiles([
      { path: 'agents/reviewer.md', content: '# reviewer\n\n**Model:** sonnet\n\n## System Prompt\n\nYou review code.\n\n## Allowed Tools\n- Read\n- Grep' },
    ]);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('agent');
    expect((result.nodes[0].data as { model: string }).model).toBe('sonnet');
    expect((result.nodes[0].data as { allowedTools: string[] }).allowedTools).toContain('Read');
  });

  it('parses hooks from hooks.json', () => {
    const result = parsePluginFiles([
      {
        path: 'hooks/hooks.json',
        content: JSON.stringify({
          PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'echo check' }] }],
        }),
      },
    ]);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('hook');
    expect((result.nodes[0].data as { event: string }).event).toBe('PreToolUse');
  });

  it('creates edges from hook to referenced rule', () => {
    const result = parsePluginFiles([
      { path: 'rules/standards.md', content: '# Standards' },
      {
        path: 'hooks/hooks.json',
        content: JSON.stringify({
          PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'cat rules/standards.md' }] }],
        }),
      },
    ]);
    expect(result.edges.length).toBeGreaterThan(0);
    const ruleNode = result.nodes.find(n => n.type === 'rule');
    const hookNode = result.nodes.find(n => n.type === 'hook');
    expect(result.edges[0].source).toBe(hookNode!.id);
    expect(result.edges[0].target).toBe(ruleNode!.id);
  });

  it('warns on malformed hooks.json', () => {
    const result = parsePluginFiles([
      { path: 'hooks/hooks.json', content: 'not valid json{' },
    ]);
    expect(result.warnings).toContain('Could not parse hooks/hooks.json');
  });

  it('generates unique IDs across multiple calls (no global state leak)', () => {
    const result1 = parsePluginFiles([{ path: 'rules/a.md', content: '# A' }]);
    const result2 = parsePluginFiles([{ path: 'rules/b.md', content: '# B' }]);
    // Both should start with counter 1 (independent calls)
    expect(result1.nodes[0].id).toBe(result2.nodes[0].id.replace('b', 'a').replace(/\d+$/, result1.nodes[0].id.match(/\d+$/)![0]));
    // More importantly, IDs should follow the same pattern
    expect(result1.nodes[0].id).toMatch(/^rule-import-1$/);
    expect(result2.nodes[0].id).toMatch(/^rule-import-1$/);
  });
});
