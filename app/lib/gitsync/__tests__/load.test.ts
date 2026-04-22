import { describe, it, expect } from 'vitest';
import { parseRepoUrl } from '../load';

describe('parseRepoUrl', () => {
  it('parses full GitHub URL with default branch', () => {
    expect(parseRepoUrl('https://github.com/johannesfritz/cc-podcast-team')).toEqual({
      owner: 'johannesfritz',
      repo: 'cc-podcast-team',
      branch: 'main',
    });
  });
  it('parses URL with explicit branch via /tree/', () => {
    expect(parseRepoUrl('https://github.com/jf/repo/tree/feature-x')).toEqual({
      owner: 'jf',
      repo: 'repo',
      branch: 'feature-x',
    });
  });
  it('strips .git suffix', () => {
    expect(parseRepoUrl('https://github.com/jf/repo.git')).toEqual({
      owner: 'jf',
      repo: 'repo',
      branch: 'main',
    });
  });
  it('parses owner/repo shorthand', () => {
    expect(parseRepoUrl('jf/repo')).toEqual({ owner: 'jf', repo: 'repo', branch: 'main' });
  });
  it('parses owner/repo@branch shorthand', () => {
    expect(parseRepoUrl('jf/repo@dev')).toEqual({ owner: 'jf', repo: 'repo', branch: 'dev' });
  });
  it('honors custom default branch', () => {
    expect(parseRepoUrl('jf/repo', 'master')).toEqual({ owner: 'jf', repo: 'repo', branch: 'master' });
  });
  it('returns null for unparseable input', () => {
    expect(parseRepoUrl('not a url')).toBeNull();
    expect(parseRepoUrl('')).toBeNull();
  });
});
