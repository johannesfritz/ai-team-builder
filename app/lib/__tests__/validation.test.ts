import { describe, it, expect } from 'vitest';
import { validateNode, getNodeHealth } from '../validation';

describe('validateNode', () => {
  describe('rule', () => {
    it('requires name', () => {
      const result = validateNode('rule', { content: 'some content' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'name' }));
    });

    it('warns on non-kebab-case name', () => {
      const result = validateNode('rule', { name: 'MyRule', content: 'x' });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(expect.objectContaining({ field: 'name' }));
    });

    it('accepts valid kebab-case name', () => {
      const result = validateNode('rule', { name: 'code-standards', content: 'x' });
      expect(result.errors).toHaveLength(0);
      const nameWarning = result.warnings.find(w => w.field === 'name');
      expect(nameWarning).toBeUndefined();
    });

    it('warns on large rule without path filter', () => {
      const result = validateNode('rule', { name: 'big', content: 'x'.repeat(1100) });
      expect(result.warnings).toContainEqual(expect.objectContaining({ field: 'pathFilter' }));
    });

    it('does not warn on large rule with path filter', () => {
      const result = validateNode('rule', { name: 'big', pathFilter: '**/*.py', content: 'x'.repeat(1100) });
      const pfWarning = result.warnings.find(w => w.field === 'pathFilter');
      expect(pfWarning).toBeUndefined();
    });

    it('errors on invalid glob pattern', () => {
      const result = validateNode('rule', { name: 'test', pathFilter: '[invalid', content: 'x' });
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'pathFilter' }));
    });
  });

  describe('hook', () => {
    it('requires event', () => {
      const result = validateNode('hook', { matcher: 'Edit' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'event' }));
    });

    it('warns when no matcher set', () => {
      const result = validateNode('hook', { event: 'PreToolUse' });
      expect(result.warnings).toContainEqual(expect.objectContaining({ field: 'matcher' }));
    });

    it('errors on invalid regex matcher', () => {
      const result = validateNode('hook', { event: 'PreToolUse', matcher: '[invalid(' });
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'matcher' }));
    });

    it('warns PreToolUse without once flag', () => {
      const result = validateNode('hook', { event: 'PreToolUse', matcher: 'Edit', once: false });
      expect(result.warnings).toContainEqual(expect.objectContaining({ field: 'once' }));
    });
  });

  describe('skill', () => {
    it('requires name', () => {
      const result = validateNode('skill', {});
      expect(result.valid).toBe(false);
    });

    it('warns when no description', () => {
      const result = validateNode('skill', { name: 'run-tests' });
      expect(result.warnings).toContainEqual(expect.objectContaining({ field: 'description' }));
    });

    it('errors on invalid filePattern glob', () => {
      const result = validateNode('skill', { name: 'test', filePattern: '[bad' });
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'filePattern' }));
    });

    it('errors on invalid bashPattern regex', () => {
      const result = validateNode('skill', { name: 'test', bashPattern: '[invalid(' });
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'bashPattern' }));
    });
  });

  describe('command', () => {
    it('requires name', () => {
      const result = validateNode('command', {});
      expect(result.valid).toBe(false);
    });

    it('errors if name starts with /', () => {
      const result = validateNode('command', { name: '/review' });
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'name', message: expect.stringContaining('/') }));
    });

    it('warns when no prompt', () => {
      const result = validateNode('command', { name: 'review' });
      expect(result.warnings).toContainEqual(expect.objectContaining({ field: 'prompt' }));
    });
  });

  describe('agent', () => {
    it('requires name and model', () => {
      const result = validateNode('agent', {});
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'name' }));
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'model' }));
    });

    it('warns on unrestricted tools', () => {
      const result = validateNode('agent', { name: 'test', model: 'sonnet', allowedTools: [] });
      expect(result.warnings).toContainEqual(expect.objectContaining({ field: 'allowedTools' }));
    });

    it('no tools warning when tools are set', () => {
      const result = validateNode('agent', { name: 'test', model: 'sonnet', allowedTools: ['Read'] });
      const toolsWarning = result.warnings.find(w => w.field === 'allowedTools');
      expect(toolsWarning).toBeUndefined();
    });
  });

  describe('mcp', () => {
    it('requires serverName and command', () => {
      const result = validateNode('mcp', {});
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'serverName' }));
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'command' }));
    });

    it('valid with required fields', () => {
      const result = validateNode('mcp', { serverName: 'api', command: 'node' });
      expect(result.valid).toBe(true);
    });
  });
});

describe('getNodeHealth', () => {
  it('returns error when validation fails', () => {
    expect(getNodeHealth('rule', {})).toBe('error');
  });

  it('returns warning when warnings exist', () => {
    expect(getNodeHealth('rule', { name: 'test' })).toBe('warning');
  });

  it('returns valid when no issues', () => {
    expect(getNodeHealth('mcp', { serverName: 'api', command: 'node' })).toBe('valid');
  });
});
