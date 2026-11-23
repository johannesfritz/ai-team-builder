import { describe, it, expect } from 'vitest';
import { MODEL_ALIASES, PRICING_USD_PER_MTOK, computeCost, formatCost, resolveModel } from '../pricing';
import { TEMPLATES } from '../../templates';

describe('PRICING_USD_PER_MTOK', () => {
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
    // 1000 input + 1000 output on sonnet = Claude Sonnet 5.5 ($2/$10 per MTok)
    // = 1000/1e6 * 2 + 1000/1e6 * 10 = 0.002 + 0.010 = 0.012
    expect(computeCost({ model: 'sonnet', inputTokens: 1000, outputTokens: 1000 })).toBeCloseTo(0.012, 5);
  });

  it('computes haiku cost correctly', () => {
    // 1000 input + 1000 output on haiku = Claude Haiku 5.5 ($0.10/$0.50 per MTok)
    // = 0.0001 + 0.0005 = 0.0006
    expect(computeCost({ model: 'haiku', inputTokens: 1000, outputTokens: 1000 })).toBeCloseTo(0.0006, 6);
  });

  it('charges Claude Haiku 5.5 its higher rates above 100,000 input tokens', () => {
    // 200,000 input + 1000 output at $0.50/$2.50 per MTok = 0.1 + 0.0025 = 0.1025
    expect(computeCost({ model: 'claude-haiku-5-5', inputTokens: 200_000, outputTokens: 1000 })).toBeCloseTo(0.1025, 6);
    // 100,000 input is still the lower tier: 0.01 + 0.0005 = 0.0105
    expect(computeCost({ model: 'claude-haiku-5-5', inputTokens: 100_000, outputTokens: 1000 })).toBeCloseTo(0.0105, 6);
  });
});

describe('MODEL_ALIASES', () => {
  it('resolves every alias to a 5.5 model that has a price', () => {
    for (const [alias, id] of Object.entries(MODEL_ALIASES)) {
      expect(id, `alias '${alias}'`).toMatch(/^claude-(opus|sonnet|haiku)-5-5$/);
      expect(PRICING_USD_PER_MTOK[resolveModel(alias)]).toBeDefined();
    }
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
