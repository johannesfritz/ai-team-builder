// runWorkflow — executes a Live Test run against the proxy with streaming.
//
// Walks agents in topological order starting from an optional startStepId. For each step:
// 1. Build input from parent outputs (or user prompt for root).
// 2. Open fetch to proxy with AbortController.signal.
// 3. Consume Anthropic SSE stream; dispatch to state updaters.
// 4. On step completion, advance to next step.
// 5. On cancel (controller.abort()), propagate cleanly; proxy detects disconnect
//    and closes upstream to Anthropic, stopping billing within ~100ms.

import type { Edge, Node } from '@xyflow/react';
import { consumeAnthropicStream } from './sse';
import { buildStepInput } from './input';
import { DEFAULT_OUTPUT_BUDGET, computeCost, resolveModel } from '../anthropic/pricing';

export const PROXY_ANTHROPIC_ENDPOINT = '/ai-team-builder/api/anthropic/messages';

export interface AgentData {
  name: string;
  model: string;
  systemPrompt: string;
  maxOutputTokens?: number;
}

export interface StepFinal {
  outputText: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  costUsd: number | null;
}

export interface StepRunCallbacks {
  onStart?: () => void;
  onTextDelta?: (text: string) => void;
  onFinal?: (final: StepFinal) => void;
  onError?: (err: { kind: string; message: string; partialOutput: string }) => void;
}

export interface RunStepOptions {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userInput: string;
  maxOutputTokens?: number;
  signal: AbortSignal;
  proxyEndpoint?: string;
}

/**
 * Run one agent step to completion. Streams token deltas via onTextDelta,
 * then calls onFinal with full result (or onError with partial output).
 */
export async function runStep(opts: RunStepOptions, callbacks: StepRunCallbacks): Promise<void> {
  const {
    apiKey,
    model,
    systemPrompt,
    userInput,
    maxOutputTokens = DEFAULT_OUTPUT_BUDGET,
    signal,
    proxyEndpoint = PROXY_ANTHROPIC_ENDPOINT,
  } = opts;

  const startedAt = Date.now();
  callbacks.onStart?.();

  let outputText = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await fetch(proxyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Anthropic-Key': apiKey,
      },
      body: JSON.stringify({
        model: resolveModel(model),
        system: systemPrompt,
        messages: [{ role: 'user', content: userInput }],
        stream: true,
        max_tokens: maxOutputTokens,
      }),
      signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const kind = classifyHttpError(response.status);
      callbacks.onError?.({
        kind,
        message: body || `HTTP ${response.status} ${response.statusText}`,
        partialOutput: '',
      });
      return;
    }
    if (!response.body) {
      callbacks.onError?.({ kind: 'network', message: 'No response body', partialOutput: '' });
      return;
    }

    await consumeAnthropicStream(response.body, {
      onMessageStart: (msg) => {
        inputTokens = msg.usage.input_tokens;
      },
      onTextDelta: (text) => {
        outputText += text;
        callbacks.onTextDelta?.(text);
      },
      onMessageDelta: (usage) => {
        outputTokens = usage.output_tokens;
      },
      onMessageStop: () => {
        callbacks.onFinal?.({
          outputText,
          inputTokens,
          outputTokens,
          durationMs: Date.now() - startedAt,
          costUsd: computeCost({ model: resolveModel(model), inputTokens, outputTokens }),
        });
      },
      onError: (err) => {
        callbacks.onError?.({
          kind: err.type,
          message: err.message,
          partialOutput: outputText,
        });
      },
    });
  } catch (err) {
    const e = err as { name?: string; message?: string };
    if (e.name === 'AbortError') {
      callbacks.onError?.({ kind: 'cancelled', message: 'Cancelled by user', partialOutput: outputText });
    } else {
      callbacks.onError?.({
        kind: 'network',
        message: e.message ?? 'Network error',
        partialOutput: outputText,
      });
    }
  }
}

function classifyHttpError(status: number): string {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  if (status === 529) return 'overloaded';
  if (status >= 500) return 'server';
  return 'http';
}

/**
 * Topologically order agent step ids starting from startId, walking forward
 * through the DAG. Uses Kahn's algorithm over the subgraph reachable from
 * startId via agent→agent edges. A node only emits once all its agent
 * predecessors within the subgraph have emitted.
 */
export function topoOrderFrom(startId: string, nodes: Node[], edges: Edge[]): string[] {
  const agentIds = new Set(nodes.filter(n => n.type === 'agent').map(n => n.id));
  if (!agentIds.has(startId)) return [];

  // BFS forward from startId to find the reachable agent subset.
  const reachable = new Set<string>([startId]);
  const queue: string[] = [startId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (e.source === cur && agentIds.has(e.target) && !reachable.has(e.target)) {
        reachable.add(e.target);
        queue.push(e.target);
      }
    }
  }

  // Kahn: compute in-degree within the reachable set.
  const indeg = new Map<string, number>();
  for (const id of reachable) indeg.set(id, 0);
  for (const e of edges) {
    if (reachable.has(e.source) && reachable.has(e.target)) {
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    }
  }

  // Seed the queue with nodes of zero in-degree within the subset.
  // Preserve node-array order for stable output when multiple are ready.
  const nodeOrder = new Map(nodes.map((n, i) => [n.id, i]));
  const ready: string[] = [...reachable].filter(id => indeg.get(id) === 0);
  ready.sort((a, b) => (nodeOrder.get(a) ?? 0) - (nodeOrder.get(b) ?? 0));

  const out: string[] = [];
  while (ready.length) {
    const cur = ready.shift()!;
    out.push(cur);
    const children: string[] = [];
    for (const e of edges) {
      if (e.source === cur && reachable.has(e.target)) {
        const newDeg = (indeg.get(e.target) ?? 0) - 1;
        indeg.set(e.target, newDeg);
        if (newDeg === 0) children.push(e.target);
      }
    }
    children.sort((a, b) => (nodeOrder.get(a) ?? 0) - (nodeOrder.get(b) ?? 0));
    ready.push(...children);
  }

  // If cycles exist in the reachable subset, append leftovers in node-array order
  if (out.length < reachable.size) {
    const emitted = new Set(out);
    const remaining = [...reachable].filter(id => !emitted.has(id));
    remaining.sort((a, b) => (nodeOrder.get(a) ?? 0) - (nodeOrder.get(b) ?? 0));
    out.push(...remaining);
  }

  return out;
}
