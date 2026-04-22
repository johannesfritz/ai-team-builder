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
// Uses a visited set to prevent infinite loops from circular edges
function collectAncestors(nodeId: string, nodes: Node[], edges: Edge[]): Set<string> {
  const ancestors = new Set<string>();
  const visited = new Set<string>([nodeId]);
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const incomingEdges = edges.filter(e => e.target === current);
    for (const edge of incomingEdges) {
      if (!visited.has(edge.source)) {
        visited.add(edge.source);
        ancestors.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  return ancestors;
}

// Kahn's algorithm: topological sort over a subset of nodes.
// Edges between nodes outside the subset are ignored.
// Cycles are tolerated: any leftover nodes are appended in node-array order.
function topologicalSort(subsetIds: string[], nodes: Node[], edges: Edge[]): string[] {
  const subset = new Set(subsetIds);
  const indegree = new Map<string, number>();
  for (const id of subsetIds) indegree.set(id, 0);

  const subsetEdges = edges.filter(e => subset.has(e.source) && subset.has(e.target));
  for (const e of subsetEdges) {
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }

  // Seed with zero-indegree nodes, preserving node-array order for stable output
  const result: string[] = [];
  const queue = subsetIds.filter(id => indegree.get(id) === 0);

  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    for (const e of subsetEdges) {
      if (e.source === id) {
        const next = (indegree.get(e.target) ?? 0) - 1;
        indegree.set(e.target, next);
        if (next === 0) queue.push(e.target);
      }
    }
  }

  // Append any nodes left over (cycles) in node-array order
  if (result.length < subsetIds.length) {
    const seen = new Set(result);
    for (const id of subsetIds) {
      if (!seen.has(id)) result.push(id);
    }
  }

  return result;
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

  // Phase 3: Execute — Connected agents and skills, sorted topologically.
  // Topological sort ensures pipelines render in pipeline order
  // (e.g., script-writer before script-reviewer when there's an edge between them),
  // not just node-array order.
  const connectedAgentIds = nodes
    .filter(n => n.type === 'agent' && connectedIds.has(n.id))
    .map(n => n.id);
  const connectedSkillIds = nodes
    .filter(n => n.type === 'skill' && connectedIds.has(n.id))
    .map(n => n.id);

  const sortedAgentIds = topologicalSort(connectedAgentIds, nodes, edges);
  const sortedSkillIds = topologicalSort(connectedSkillIds, nodes, edges);

  const connectedAgents = sortedAgentIds.map(id => nodes.find(n => n.id === id)!);
  const connectedSkills = sortedSkillIds.map(id => nodes.find(n => n.id === id)!);

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
