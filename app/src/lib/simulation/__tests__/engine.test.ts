import { describe, it, expect } from 'vitest';
import { simulate } from '../engine';
import type { Node, Edge } from '@xyflow/react';

function makeRuleNode(id: string, name: string, pathFilter: string, content: string): Node {
  return {
    id,
    type: 'rule',
    position: { x: 0, y: 0 },
    data: { name, pathFilter, content },
  };
}

function makeHookNode(id: string, event: string, matcher: string, action: string): Node {
  return {
    id,
    type: 'hook',
    position: { x: 0, y: 0 },
    data: { event, matcher, action, once: false },
  };
}

function makeCommandNode(id: string, name: string, prompt: string): Node {
  return {
    id,
    type: 'command',
    position: { x: 0, y: 0 },
    data: { name, prompt },
  };
}

function makeSkillNode(id: string, name: string, filePattern: string, instructions: string): Node {
  return {
    id,
    type: 'skill',
    position: { x: 0, y: 0 },
    data: { name, description: '', instructions, filePattern, bashPattern: '' },
  };
}

describe('simulate', () => {
  it('returns empty steps for empty graph', () => {
    const result = simulate([], [], { prompt: 'test' });
    expect(result.componentsTotal).toBe(0);
    expect(result.componentsUsed).toBe(0);
    expect(result.totalTokens).toBe(0);
  });

  it('loads rules without path filter (always loads)', () => {
    const nodes = [makeRuleNode('r1', 'always-on', '', 'Always active rule content')];
    const result = simulate(nodes, [], { prompt: 'test' });
    expect(result.componentsUsed).toBe(1);
    expect(result.steps[0].firedComponents).toHaveLength(1);
    expect(result.steps[0].firedComponents[0].name).toBe('always-on');
  });

  it('loads rules matching path filter', () => {
    const nodes = [makeRuleNode('r1', 'py-rule', 'src/**/*.py', 'Python rule')];
    const result = simulate(nodes, [], { prompt: 'test', filePath: 'src/app.py' });
    expect(result.componentsUsed).toBe(1);
  });

  it('does NOT load rules when path filter does not match', () => {
    const nodes = [makeRuleNode('r1', 'py-rule', 'src/**/*.py', 'Python rule')];
    const result = simulate(nodes, [], { prompt: 'test', filePath: 'src/app.ts' });
    expect(result.steps[0].firedComponents).toHaveLength(0);
  });

  it('registers commands', () => {
    const nodes = [makeCommandNode('c1', 'review', 'Review the code')];
    const result = simulate(nodes, [], { prompt: 'test' });
    expect(result.componentsUsed).toBe(1);
    expect(result.steps).toContainEqual(
      expect.objectContaining({
        event: 'Commands available',
        firedComponents: expect.arrayContaining([
          expect.objectContaining({ name: '/review' }),
        ]),
      })
    );
  });

  it('fires hooks matching tool', () => {
    const nodes = [
      makeHookNode('h1', 'PreToolUse', 'Edit', 'echo check'),
    ];
    const result = simulate(nodes, [], { prompt: 'test', toolUsed: 'Edit' });
    const hookStep = result.steps.find(s => s.event.includes('Edit'));
    expect(hookStep?.firedComponents).toHaveLength(1);
  });

  it('does NOT fire hooks for non-matching tool', () => {
    const nodes = [
      makeHookNode('h1', 'PreToolUse', 'Edit', 'echo check'),
    ];
    const result = simulate(nodes, [], { prompt: 'test', toolUsed: 'Read' });
    const hookStep = result.steps.find(s => s.event.includes('Read'));
    expect(hookStep?.firedComponents).toHaveLength(0);
  });

  it('matches skills by file pattern', () => {
    const nodes = [makeSkillNode('s1', 'py-skill', '**/*.py', 'Python skill instructions')];
    const result = simulate(nodes, [], { prompt: 'test', filePath: 'src/deep/file.py' });
    const skillStep = result.steps.find(s => s.event === 'Skills matched');
    expect(skillStep?.firedComponents).toHaveLength(1);
  });
});

describe('glob matching (picomatch)', () => {
  it('handles src/**/*.py pattern', () => {
    const nodes = [makeRuleNode('r1', 'test', 'src/**/*.py', 'content')];
    const result = simulate(nodes, [], { prompt: 'test', filePath: 'src/lib/utils.py' });
    expect(result.steps[0].firedComponents).toHaveLength(1);
  });

  it('handles brace expansion {ts,tsx}', () => {
    const nodes = [makeRuleNode('r1', 'test', '**/*.{ts,tsx}', 'content')];

    const tsResult = simulate(nodes, [], { prompt: 'test', filePath: 'src/app.ts' });
    expect(tsResult.steps[0].firedComponents).toHaveLength(1);

    const tsxResult = simulate(nodes, [], { prompt: 'test', filePath: 'src/App.tsx' });
    expect(tsxResult.steps[0].firedComponents).toHaveLength(1);

    const pyResult = simulate(nodes, [], { prompt: 'test', filePath: 'src/app.py' });
    expect(pyResult.steps[0].firedComponents).toHaveLength(0);
  });

  it('handles negation patterns', () => {
    const nodes = [makeRuleNode('r1', 'test', '!node_modules/**', 'content')];
    const result = simulate(nodes, [], { prompt: 'test', filePath: 'src/app.ts' });
    expect(result.steps[0].firedComponents).toHaveLength(1);
  });

  it('handles deeply nested paths', () => {
    const nodes = [makeRuleNode('r1', 'test', '**/*.py', 'content')];
    const result = simulate(nodes, [], { prompt: 'test', filePath: 'a/b/c/d/e/file.py' });
    expect(result.steps[0].firedComponents).toHaveLength(1);
  });

  it('handles single-level wildcard correctly', () => {
    const nodes = [makeRuleNode('r1', 'test', 'src/*.py', 'content')];

    const shallowResult = simulate(nodes, [], { prompt: 'test', filePath: 'src/app.py' });
    expect(shallowResult.steps[0].firedComponents).toHaveLength(1);

    const deepResult = simulate(nodes, [], { prompt: 'test', filePath: 'src/lib/app.py' });
    expect(deepResult.steps[0].firedComponents).toHaveLength(0);
  });
});
