import { describe, it, expect } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { buildStepInput } from '../input';

const node = (id: string, type: string = 'agent', name?: string): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { name: name ?? id },
});
const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

describe('buildStepInput', () => {
  it('returns userPrompt for a root step (no agent parent)', () => {
    const nodes = [node('a1', 'agent', 'content-analyst')];
    const result = buildStepInput('a1', nodes, [], {
      userPrompt: 'Test prompt',
      stepOutputs: {},
    });
    expect(result).toBe('Test prompt');
  });

  it('returns parent output for a single-parent step', () => {
    const nodes = [node('a1'), node('a2')];
    const edges = [edge('e1', 'a1', 'a2')];
    const result = buildStepInput('a2', nodes, edges, {
      userPrompt: 'Test',
      stepOutputs: { a1: 'Output of agent 1' },
    });
    expect(result).toBe('Output of agent 1');
  });

  it('concatenates parent outputs with separators for convergence', () => {
    const nodes = [
      node('a1', 'agent', 'script-reviewer'),
      node('a2', 'agent', 'fact-checker'),
      node('a3', 'agent', 'voice-producer'),
    ];
    const edges = [edge('e1', 'a1', 'a3'), edge('e2', 'a2', 'a3')];
    const result = buildStepInput('a3', nodes, edges, {
      userPrompt: 'Test',
      stepOutputs: { a1: 'Reviewer said ok', a2: 'Facts check out' },
    });
    expect(result).toContain('--- from script-reviewer ---');
    expect(result).toContain('Reviewer said ok');
    expect(result).toContain('--- from fact-checker ---');
    expect(result).toContain('Facts check out');
  });

  it('ignores skill parents (they do not contribute runtime input)', () => {
    const nodes = [node('a1', 'agent'), node('s1', 'skill'), node('a2', 'agent')];
    const edges = [edge('e1', 'a1', 'a2'), edge('e2', 's1', 'a2')];
    const result = buildStepInput('a2', nodes, edges, {
      userPrompt: 'fallback',
      stepOutputs: { a1: 'From A1', s1: 'From skill' },
    });
    expect(result).toBe('From A1');
  });

  it('handles missing parent output with empty string (parent not yet run)', () => {
    const nodes = [node('a1'), node('a2')];
    const edges = [edge('e1', 'a1', 'a2')];
    const result = buildStepInput('a2', nodes, edges, {
      userPrompt: 'Test',
      stepOutputs: {},
    });
    expect(result).toBe('');
  });
});
