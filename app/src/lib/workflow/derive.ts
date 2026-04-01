// Derive workflow sequence from graph edges
// Walk backwards from a Command node to find all related components

import type { Node, Edge } from '@xyflow/react';
import type { RuleData, HookData, SkillData, CommandData, AgentData, PluginNodeType } from '../plugin-types';

export interface WorkflowStep {
  nodeId: string;
  nodeType: PluginNodeType;
  name: string;
  description: string;
  tokenEstimate: number;
  phase: 'setup' | 'trigger' | 'execute' | 'entry';
}

function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

export function deriveWorkflow(
  commandNodeId: string,
  nodes: Node[],
  edges: Edge[],
): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  const visitedIds = new Set<string>();

  const commandNode = nodes.find(n => n.id === commandNodeId);
  if (!commandNode || commandNode.type !== 'command') return [];

  // Phase 1: Setup — Rules that always load (no path filter or universal)
  for (const node of nodes) {
    if (node.type !== 'rule') continue;
    const d = node.data as unknown as RuleData;
    visitedIds.add(node.id);
    steps.push({
      nodeId: node.id,
      nodeType: 'rule',
      name: d.name || 'Unnamed rule',
      description: d.pathFilter ? `Loads for: ${d.pathFilter}` : 'Always loaded (global)',
      tokenEstimate: estimateTokens(d.content),
      phase: 'setup',
    });
  }

  // Phase 2: Trigger — Hooks (find hooks that connect to skills/rules in this workflow)
  for (const node of nodes) {
    if (node.type !== 'hook') continue;
    const d = node.data as unknown as HookData;
    visitedIds.add(node.id);
    const targets = edges.filter(e => e.source === node.id).map(e => {
      const t = nodes.find(n => n.id === e.target);
      return t ? (t.data as unknown as { name?: string }).name || t.type : '';
    }).filter(Boolean);

    steps.push({
      nodeId: node.id,
      nodeType: 'hook',
      name: `${d.event}: ${d.matcher || '*'}`,
      description: targets.length > 0
        ? `Injects: ${targets.join(', ')}${d.once ? ' (once)' : ''}`
        : d.once ? 'Fires once per session' : 'Fires on every match',
      tokenEstimate: 0, // Hooks themselves are zero tokens; they inject other content
      phase: 'trigger',
    });
  }

  // Phase 3: Execute — Skills connected to this command (walk backwards: skill → command)
  const skillEdges = edges.filter(e => e.target === commandNodeId);
  for (const edge of skillEdges) {
    const skillNode = nodes.find(n => n.id === edge.source && n.type === 'skill');
    if (!skillNode) continue;
    const d = skillNode.data as unknown as SkillData;
    visitedIds.add(skillNode.id);

    // Find agent that uses this skill
    const agentEdge = edges.find(e => e.target === skillNode.id);
    const agentNode = agentEdge ? nodes.find(n => n.id === agentEdge.source && n.type === 'agent') : null;

    if (agentNode && !visitedIds.has(agentNode.id)) {
      const ad = agentNode.data as unknown as AgentData;
      visitedIds.add(agentNode.id);
      steps.push({
        nodeId: agentNode.id,
        nodeType: 'agent',
        name: ad.name || 'Unnamed agent',
        description: `Model: ${ad.model}${ad.allowedTools?.length ? ` | Tools: ${ad.allowedTools.join(', ')}` : ''}`,
        tokenEstimate: estimateTokens(ad.systemPrompt),
        phase: 'execute',
      });
    }

    steps.push({
      nodeId: skillNode.id,
      nodeType: 'skill',
      name: d.name || 'Unnamed skill',
      description: d.description || (d.filePattern ? `Files: ${d.filePattern}` : ''),
      tokenEstimate: estimateTokens(d.instructions),
      phase: 'execute',
    });
  }

  // Also find skills not directly connected to this command but used by agents that are
  for (const node of nodes) {
    if (node.type === 'skill' && !visitedIds.has(node.id)) {
      const d = node.data as unknown as SkillData;
      // Check if any agent using this skill is already in our workflow
      const agentEdge = edges.find(e => e.target === node.id);
      if (agentEdge && visitedIds.has(agentEdge.source)) {
        visitedIds.add(node.id);
        steps.push({
          nodeId: node.id,
          nodeType: 'skill',
          name: d.name || 'Unnamed skill',
          description: d.description || '',
          tokenEstimate: estimateTokens(d.instructions),
          phase: 'execute',
        });
      }
    }
  }

  // Phase 4: Entry — The command itself
  const cd = commandNode.data as unknown as CommandData;
  steps.push({
    nodeId: commandNodeId,
    nodeType: 'command',
    name: `/${cd.name || 'untitled'}`,
    description: cd.description || 'User invocation point',
    tokenEstimate: estimateTokens(cd.prompt),
    phase: 'entry',
  });

  return steps;
}

export function getCommandNodes(nodes: Node[]): Array<{ id: string; name: string }> {
  return nodes
    .filter(n => n.type === 'command')
    .map(n => ({
      id: n.id,
      name: (n.data as unknown as CommandData).name || 'untitled',
    }));
}
