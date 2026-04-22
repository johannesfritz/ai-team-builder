import { describe, it, expect } from 'vitest';
import { PRICING_USD_PER_MTOK, PRICING_VERIFIED_AT, computeCost, formatCost } from '../pricing';
import { TEMPLATES } from '../../templates';

describe('PRICING_USD_PER_MTOK', () => {
  it('has a verification date set', () => {
    expect(PRICING_VERIFIED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('covers every model referenced by any template agent', () => {
    for (const template of TEMPLATES) {
      for (const nodeDef of template.nodes) {
        if (nodeDef.type !== 'agent') continue;
        const model = (nodeDef.data as { model?: string }).model;
        if (!model) continue;
        expect(
          PRICING_USD_PER_MTOK[model],
          `Template ${template.id} uses model '${model}' which has no pricing entry. Add it to pricing.ts.`,
        ).toBeDefined();
      }
    }
  });
});

describe('computeCost', () => {
  it('returns null for unknown model', () => {
    expect(computeCost({ model: 'nonexistent-model', inputTokens: 100, outputTokens: 100 })).toBeNull();
  });

  it('computes sonnet cost correctly', () => {
    // 1000 input + 1000 output on sonnet ($3/$15 per MTok)
    // = 1000/1e6 * 3 + 1000/1e6 * 15 = 0.003 + 0.015 = 0.018
    expect(computeCost({ model: 'sonnet', inputTokens: 1000, outputTokens: 1000 })).toBeCloseTo(0.018, 5);
  });

  it('computes haiku cost correctly', () => {
    // 1000 input + 1000 output on haiku ($0.80/$4 per MTok)
    // = 0.0008 + 0.004 = 0.0048
    expect(computeCost({ model: 'haiku', inputTokens: 1000, outputTokens: 1000 })).toBeCloseTo(0.0048, 5);
  });
});

describe('formatCost', () => {
  it('uses 3 decimals under $0.10', () => {
    expect(formatCost(0.018)).toBe('$0.018');
    expect(formatCost(0.003)).toBe('$0.003');
  });
  it('uses 2 decimals at or above $0.10', () => {
    expect(formatCost(0.18)).toBe('$0.18');
    expect(formatCost(1.5)).toBe('$1.50');
  });
});
