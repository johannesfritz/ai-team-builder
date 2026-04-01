// Derive workflow sequence from graph edges
// Walk backwards from a Command node to find CONNECTED components only

import type { Node, Edge } from '@xyflow/react';
import type { RuleData, HookData, SkillData, CommandData, AgentData, PluginNodeType } from '../plugin-types';

export interface WorkflowStep {
  nodeId: string;
  nodeType: PluginNodeType;
  name: string;
  description: string;
  tokenEstimate: number;
  phase: 'setup' | 'trigger' | 'execute' | 'entry';
  isGlobal?: boolean; // true for unconnected rules/hooks (shared across all commands)
}

function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

// Walk backwards from a node, collecting all ancestors via edges
function collectAncestors(nodeId: string, nodes: Node[], edges: Edge[]): Set<string> {
  const ancestors = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const incomingEdges = edges.filter(e => e.target === current);
    for (const edge of incomingEdges) {
      if (!ancestors.has(edge.source)) {
        ancestors.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  return ancestors;
}

export function deriveWorkflow(
  commandNodeId: string,
  nodes: Node[],
  edges: Edge[],
): WorkflowStep[] {
  const steps: WorkflowStep[] = [];

  const commandNode = nodes.find(n => n.id === commandNodeId);
  if (!commandNode || commandNode.type !== 'command') return [];

  // Find all nodes connected to this command (backwards through edges)
  const connectedIds = collectAncestors(commandNodeId, nodes, edges);
  connectedIds.add(commandNodeId);

  // Also find "global" components — rules without path filter and hooks not connected to anything
  // These apply to ALL commands, so show them but marked as global
  const globalRules = nodes.filter(n =>
    n.type === 'rule' &&
    !connectedIds.has(n.id) &&
    !(n.data as unknown as RuleData).pathFilter
  );

  const connectedHooks = nodes.filter(n =>
    n.type === 'hook' && connectedIds.has(n.id)
  );

  // Phase 1: Setup — Connected rules + global rules
  const connectedRules = nodes.filter(n => n.type === 'rule' && connectedIds.has(n.id));

  for (const node of connectedRules) {
    const d = node.data as unknown as RuleData;
    steps.push({
      nodeId: node.id,
      nodeType: 'rule',
      name: d.name || 'Unnamed rule',
      description: d.pathFilter ? `Loads for: ${d.pathFilter}` : 'Always loaded',
      tokenEstimate: estimateTokens(d.content),
      phase: 'setup',
    });
  }

  for (const node of globalRules) {
    const d = node.data as unknown as RuleData;
    steps.push({
      nodeId: node.id,
      nodeType: 'rule',
      name: d.name || 'Unnamed rule',
      description: 'Global rule (applies to all commands)',
      tokenEstimate: estimateTokens(d.content),
      phase: 'setup',
      isGlobal: true,
    });
  }

  // Phase 2: Trigger — Connected hooks
  for (const node of connectedHooks) {
    const d = node.data as unknown as HookData;
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
      tokenEstimate: 0,
      phase: 'trigger',
    });
  }

  // Phase 3: Execute — Connected agents and skills
  const connectedAgents = nodes.filter(n => n.type === 'agent' && connectedIds.has(n.id));
  const connectedSkills = nodes.filter(n => n.type === 'skill' && connectedIds.has(n.id));

  for (const node of connectedAgents) {
    const d = node.data as unknown as AgentData;
    steps.push({
      nodeId: node.id,
      nodeType: 'agent',
      name: d.name || 'Unnamed agent',
      description: `Model: ${d.model}${d.allowedTools?.length ? ` | Tools: ${d.allowedTools.join(', ')}` : ''}`,
      tokenEstimate: estimateTokens(d.systemPrompt),
      phase: 'execute',
    });
  }

  for (const node of connectedSkills) {
    const d = node.data as unknown as SkillData;
    steps.push({
      nodeId: node.id,
      nodeType: 'skill',
      name: d.name || 'Unnamed skill',
      description: d.description || (d.filePattern ? `Files: ${d.filePattern}` : ''),
      tokenEstimate: estimateTokens(d.instructions),
      phase: 'execute',
    });
  }

  // Phase 4: Entry — The command itself
  const cd = commandNode.data as unknown as CommandData;

  // For commands with structured prompts (markdown headings), extract phases as pseudo-steps
  // This makes imported commands (with no edges) show their internal workflow
  if (cd.prompt && connectedIds.size <= 1) {
    const headings = cd.prompt.match(/^##\s+(.+)/gm);
    if (headings && headings.length >= 2) {
      for (const heading of headings) {
        const phaseName = heading.replace(/^##\s+/, '').trim();
        // Extract content between this heading and the next
        const headingIdx = cd.prompt.indexOf(heading);
        const nextHeadingMatch = cd.prompt.substring(headingIdx + heading.length).match(/\n##\s/);
        const sectionEnd = nextHeadingMatch
          ? headingIdx + heading.length + nextHeadingMatch.index!
          : cd.prompt.length;
        const sectionContent = cd.prompt.substring(headingIdx + heading.length, sectionEnd).trim();
        const firstLine = sectionContent.split('\n')[0]?.trim() || '';

        steps.push({
          nodeId: commandNodeId,
          nodeType: 'command',
          name: phaseName,
          description: firstLine.substring(0, 100),
          tokenEstimate: estimateTokens(sectionContent),
          phase: 'execute',
        });
      }
    }
  }

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
