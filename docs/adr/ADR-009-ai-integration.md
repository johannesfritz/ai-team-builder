# ADR-009: AI Integration — Anthropic Claude API (Direct) via Vercel AI SDK

**Status:** Accepted
**Date:** 2026-03-28
**Decision Makers:** Solutions Architect (Claude)

---

## Institutional Memory Check

Related ADRs:
- FRIDAY architecture: Uses Claude (Sonnet for speed, Opus for quality gates) + OpenAI embeddings. Established pattern of using Claude for reasoning, OpenAI for embeddings.
- Environment & Model Defaults rule: Claude is the default for code/reasoning/writing. Gemini for classification. OpenAI for embeddings.
- Metis server: Uses Claude CLI for autonomous agent execution with budget caps.

Consistency Analysis:
- Using Claude API for AI features is fully consistent with the established pattern. The Vercel AI SDK is new but provides a useful abstraction for streaming and tool calling.

---

## Context

Bot the Builder has three AI-powered features:

| Feature | Description | LLM Requirements |
|---------|-------------|-----------------|
| **AI-Assisted Config** | Generate hook matchers, skill prompts, and rule content from natural language descriptions | Fast responses, good at code generation |
| **Dry Run Simulation** | Simulate how Claude Code would resolve hooks and skills for a given tool call | Must understand Claude Code's hook/skill resolution logic |
| **Machine Improvement** | Iteratively improve plugin configs through evaluation loops | Multi-turn reasoning, self-critique capability |

All three features benefit from using Claude — we are building a tool for Claude Code, so using Claude to understand Claude Code's behavior is natural (eating our own dog food).

---

## Decision

Use the **Anthropic Claude API directly**, accessed through the **Vercel AI SDK** (`@ai-sdk/anthropic` provider) for the TypeScript layer and the **Anthropic Python SDK** for the Python AI service.

### Model Selection

| Feature | Model | Rationale |
|---------|-------|-----------|
| AI-Assisted Config | Claude Sonnet | Fast, good at structured output, cost-effective |
| Dry Run Simulation | Claude Sonnet | Deterministic-ish simulation, speed matters |
| Machine Improvement | Claude Opus | Quality-critical: must self-critique and improve iteratively |

---

## Options Considered

### Option A: Claude API via Vercel AI SDK — SELECTED

**Pros:**
- **Dog-fooding** — building Claude Code tools with Claude. Deep alignment between the tool and the LLM understanding it.
- Vercel AI SDK provides streaming, tool calling, structured output in a framework-agnostic way
- AI SDK's `@ai-sdk/anthropic` provider is well-maintained
- Streaming responses work natively with Next.js App Router (React Server Components + Suspense)
- AI SDK supports switching providers (can add OpenAI/Gemini fallback later)
- Python service uses Anthropic SDK directly (proven in existing projects)
- Model routing: Sonnet for speed, Opus for quality — established pattern

**Cons:**
- Single provider dependency (mitigated: AI SDK abstracts provider, can add fallback)
- Claude API costs: Sonnet ~$3/$15 per MTok, Opus ~$15/$75 per MTok
- No built-in caching (must implement prompt caching or result caching ourselves)

### Option B: Vercel AI Gateway

**Pros:**
- Provider failover (automatic retry with different provider)
- Cost tracking and rate limiting built in
- Unified API across providers

**Cons:**
- Additional cost (AI Gateway pricing on top of API costs)
- Adds latency (extra hop through gateway)
- Over-engineered for MVP with a single provider
- We want Claude specifically (not a generic LLM) — failover to a different model changes behavior

### Option C: OpenAI API

**Pros:**
- Largest ecosystem, most tooling
- GPT-4o is fast and capable

**Cons:**
- Not eating our own dog food — building Claude Code tools with a competitor's LLM
- OpenAI models have less Claude Code-specific knowledge
- Breaks the established pattern (Claude for reasoning, OpenAI only for embeddings)

### Option D: Multi-provider from Day 1

**Rejected** — premature optimization. Using multiple providers adds complexity (prompt engineering per model, behavior differences, cost tracking per provider). Start with Claude only. Add providers if specific features need different capabilities.

---

## Consequences

### Positive

1. **Domain alignment** — Claude understands Claude Code's concepts natively (hooks, skills, settings.json structure)
2. **Streaming** — AI SDK provides streaming responses for real-time builder feedback
3. **Structured output** — AI SDK's `generateObject` produces typed config objects directly
4. **Consistent with codebase** — same provider and patterns as all other AI features
5. **Model flexibility** — Sonnet for speed, Opus for quality, within the same provider

### Negative

1. **Single provider risk** — Claude API outage affects all AI features (mitigated: non-AI features still work)
2. **Cost** — Opus for machine improvement is expensive. Must implement budget caps per user/session.
3. **No caching layer** — must implement caching for repeated similar requests (e.g., dry run with same config)

### Trade-off

A multi-provider setup with AI Gateway would provide resilience but add complexity and cost. For MVP, single-provider simplicity wins. The AI features are enhancements, not core functionality — the builder works without AI (manual config editing). If Claude API goes down, users can still build plugins manually.

---

## Implementation Notes

### TypeScript Layer (Next.js API Routes)

```typescript
// AI-assisted config generation
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';

const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  output: Output.object({ schema: hookConfigSchema }),
  prompt: `Generate a PreToolUse hook configuration that ${userDescription}`,
});
```

### Python Layer (FastAPI AI Service)

```python
# Dry run simulation
import anthropic

client = anthropic.AsyncAnthropic()

async def simulate_dry_run(plugin_config: dict, tool_call: str) -> DryRunResult:
    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        messages=[
            {"role": "user", "content": build_simulation_prompt(plugin_config, tool_call)}
        ],
        max_tokens=4096,
    )
    return parse_dry_run_result(response)
```

### Machine Improvement Loop

```python
# Machine improvement (uses Opus for quality)
async def improve_plugin(config: dict, evaluation: str, max_iterations: int = 3) -> dict:
    for i in range(max_iterations):
        critique = await client.messages.create(
            model="claude-opus-4-20250514",
            messages=[{"role": "user", "content": build_critique_prompt(config, evaluation)}],
        )
        improved = await client.messages.create(
            model="claude-opus-4-20250514",
            messages=[{"role": "user", "content": build_improve_prompt(config, critique)}],
        )
        config = parse_config(improved)
        if meets_quality_threshold(config):
            break
    return config
```

### Cost Controls

- **Per-user budget**: Track API costs per user, cap at $X/month for free tier
- **Rate limiting**: Max N AI requests per minute per user
- **Model routing**: Use Sonnet by default, Opus only for explicit "improve" actions
- **Caching**: Cache dry run results for identical configs (Redis or Vercel KV)

### Estimated API Costs

| Feature | Model | Tokens/Request | Cost/Request | Requests/Day (Est.) |
|---------|-------|---------------|-------------|-------------------|
| AI Config | Sonnet | ~2K in, ~1K out | ~$0.02 | 500 |
| Dry Run | Sonnet | ~3K in, ~2K out | ~$0.04 | 200 |
| Improve | Opus | ~5K in, ~3K out (x3 iterations) | ~$0.50 | 50 |

Estimated daily cost at moderate usage: ~$40/day (~$1,200/month). Must be offset by marketplace revenue or gated behind paid plans.

---

## Related ADRs

- ADR-002: Backend Architecture (Python service handles LLM calls)
- ADR-008: Deployment (Vercel Functions runtime for AI service)
