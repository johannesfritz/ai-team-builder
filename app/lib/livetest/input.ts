// Step input contract for Live Test.
//
// Rules:
// - Step input text = output text of the most recent parent (agent) in the DAG.
// - If a step has multiple agent parents (convergence node, rare), concatenate
//   parent outputs in topological order with a separator.
// - First step (no agent parent) receives the user's top-level test prompt.

import type { Edge, Node } from '@xyflow/react';
import { directParents } from './dag';

export interface StepInputContext {
  userPrompt: string;
  stepOutputs: Record<string, string>;
}

export function buildStepInput(
  stepId: string,
  nodes: Node[],
  edges: Edge[],
  ctx: StepInputContext,
): string {
  const agentParents = directParents(stepId, edges, nodes, 'agent');
  if (agentParents.length === 0) {
    return ctx.userPrompt;
  }
  if (agentParents.length === 1) {
    const parent = agentParents[0];
    return ctx.stepOutputs[parent.id] ?? '';
  }
  // Convergence: concatenate parent outputs with a legible separator.
  return agentParents
    .map(parent => {
      const name = (parent.data as { name?: string })?.name ?? parent.id;
      const output = ctx.stepOutputs[parent.id] ?? '';
      return `--- from ${name} ---\n${output}`;
    })
    .join('\n\n');
}
