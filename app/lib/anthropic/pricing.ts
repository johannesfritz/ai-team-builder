// Anthropic pricing, USD per million tokens.
// Source: https://www.anthropic.com/pricing
// Implementer: verify these numbers against the live pricing page on the day of merge
// and bump PRICING_VERIFIED_AT.
export const PRICING_VERIFIED_AT = '2026-04-22';

export interface ModelPricing {
  input: number;
  output: number;
}

export const PRICING_USD_PER_MTOK: Record<string, ModelPricing> = {
  'claude-opus-4-7': { input: 15.0, output: 75.0 },
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-opus-4-5': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 0.8, output: 4.0 },
  // Aliases used in templates
  opus: { input: 15.0, output: 75.0 },
  sonnet: { input: 3.0, output: 15.0 },
  haiku: { input: 0.8, output: 4.0 },
};

// Default max_tokens per step when the agent node does not specify one.
export const DEFAULT_OUTPUT_BUDGET = 2000;

/**
 * Map Claude Code shorthand aliases to canonical Anthropic API model IDs.
 * Templates often use 'haiku' / 'sonnet' / 'opus' which Claude Code accepts
 * as aliases but the Anthropic Messages API does not.
 *
 * Verified against current Anthropic model catalog 2026-04-22.
 */
export const MODEL_ALIASES: Record<string, string> = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-5',
  opus: 'claude-opus-4-5',
  inherit: 'claude-sonnet-4-5',
};

/**
 * Resolve a possibly-aliased model name to a canonical Anthropic API model ID.
 * Returns the input unchanged if it's already a canonical ID.
 */
export function resolveModel(model: string): string {
  return MODEL_ALIASES[model] ?? model;
}

export interface CostInput {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Returns cost in USD. Returns null if the model is unknown (caller should
 * surface this as a pricing-missing error; a unit test enforces that every
 * template model has an entry).
 */
export function computeCost({ model, inputTokens, outputTokens }: CostInput): number | null {
  const p = PRICING_USD_PER_MTOK[model];
  if (!p) return null;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

/**
 * Format a cost in USD: 3 decimals when under $0.10, 2 decimals otherwise.
 */
export function formatCost(usd: number): string {
  if (usd < 0.1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
