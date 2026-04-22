import { describe, it, expect } from 'vitest';
import { diffFileMaps, changedFileCount, summarizeDiff, buildCommitMessage } from '../diff';

describe('diffFileMaps', () => {
  it('detects additions', () => {
    expect(diffFileMaps({}, { a: 'x' })).toEqual({ added: ['a'], modified: [], deleted: [] });
  });
  it('detects modifications', () => {
    expect(diffFileMaps({ a: 'x' }, { a: 'y' })).toEqual({ added: [], modified: ['a'], deleted: [] });
  });
  it('detects deletions', () => {
    expect(diffFileMaps({ a: 'x' }, {})).toEqual({ added: [], modified: [], deleted: ['a'] });
  });
  it('returns empty for identical maps', () => {
    const m = { a: '1', b: '2' };
    expect(diffFileMaps(m, m)).toEqual({ added: [], modified: [], deleted: [] });
  });
  it('sorts results alphabetically', () => {
    const d = diffFileMaps({}, { z: '', a: '', m: '' });
    expect(d.added).toEqual(['a', 'm', 'z']);
  });
});

describe('changedFileCount', () => {
  it('sums all three categories', () => {
    expect(changedFileCount({ added: ['a', 'b'], modified: ['c'], deleted: ['d', 'e', 'f'] })).toBe(6);
  });
  it('returns 0 for empty diff', () => {
    expect(changedFileCount({ added: [], modified: [], deleted: [] })).toBe(0);
  });
});

describe('summarizeDiff', () => {
  it('classifies plugin file types', () => {
    const diff = {
      added: ['agents/script-reviewer.md'],
      modified: ['rules/podcast-standards.md'],
      deleted: ['skills/old-tool/SKILL.md'],
    };
    const s = summarizeDiff(diff);
    expect(s).toContain('added agent script-reviewer');
    expect(s).toContain('updated rule podcast-standards');
    expect(s).toContain('removed skill old-tool');
  });
  it('handles nested plugin-root prefix', () => {
    const diff = { added: ['.claude-plugin/agents/a1.md'], modified: [], deleted: [] };
    expect(summarizeDiff(diff)).toBe('added agent a1');
  });
  it('returns "no changes" for empty diff', () => {
    expect(summarizeDiff({ added: [], modified: [], deleted: [] })).toBe('no changes');
  });
});

describe('buildCommitMessage', () => {
  it('includes Co-Authored-By footer', () => {
    const msg = buildCommitMessage({ added: ['agents/a.md'], modified: [], deleted: [] });
    expect(msg).toContain('Co-Authored-By: AI Team Builder <noreply@ai-team-builder.dev>');
  });
  it('truncates long titles to 72 chars', () => {
    const many = Array.from({ length: 30 }, (_, i) => `agents/agent-${i}.md`);
    const msg = buildCommitMessage({ added: many, modified: [], deleted: [] });
    const firstLine = msg.split('\n')[0];
    expect(firstLine.length).toBeLessThanOrEqual(72);
  });
  it('lists changed files in body', () => {
    const msg = buildCommitMessage({
      added: ['agents/a.md'],
      modified: ['rules/r.md'],
      deleted: ['skills/old/SKILL.md'],
    });
    expect(msg).toContain('+ agents/a.md');
    expect(msg).toContain('~ rules/r.md');
    expect(msg).toContain('- skills/old/SKILL.md');
  });
});
