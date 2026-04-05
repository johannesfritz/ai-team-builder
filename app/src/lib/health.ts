import type { Node, Edge } from '@xyflow/react';
import type { RuleData, HookData, AgentData } from './plugin-types';

export interface HealthIssue {
  severity: 'error' | 'warning' | 'info';
  nodeId?: string;
  message: string;
}

export interface HealthReport {
  score: 'healthy' | 'warnings' | 'issues';
  issues: HealthIssue[];
}

function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

function detectCycles(nodes: Node[], edges: Edge[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string) {
    if (inStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart >= 0) cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    const outgoing = edges.filter(e => e.source === nodeId);
    for (const edge of outgoing) {
      dfs(edge.target);
    }

    path.pop();
    inStack.delete(nodeId);
  }

  for (const node of nodes) {
    dfs(node.id);
  }

  return cycles;
}

export function analyzeHealth(nodes: Node[], edges: Edge[]): HealthReport {
  const issues: HealthIssue[] = [];

  // Check for no commands
  const commands = nodes.filter(n => n.type === 'command');
  if (commands.length === 0 && nodes.length > 0) {
    issues.push({ severity: 'warning', message: 'No commands defined. Users need a /command to invoke this plugin.' });
  }

  // Check orphaned hooks (hooks with no outgoing edges)
  const hooks = nodes.filter(n => n.type === 'hook');
  for (const hook of hooks) {
    const outgoing = edges.filter(e => e.source === hook.id);
    if (outgoing.length === 0) {
      const d = hook.data as unknown as HookData;
      issues.push({ severity: 'warning', nodeId: hook.id, message: `Hook "${d.event}: ${d.matcher || '*'}" has no connections. Connect it to a rule or skill.` });
    }
  }

  // Check heavy rules without path filter
  const rules = nodes.filter(n => n.type === 'rule');
  for (const rule of rules) {
    const d = rule.data as unknown as RuleData;
    if (!d.pathFilter && estimateTokens(d.content) > 500) {
      issues.push({ severity: 'warning', nodeId: rule.id, message: `Rule "${d.name}" is ${estimateTokens(d.content)} tokens with no path filter. It loads every session.` });
    }
  }

  // Check unrestricted agents
  const agents = nodes.filter(n => n.type === 'agent');
  for (const agent of agents) {
    const d = agent.data as unknown as AgentData;
    if (!d.allowedTools || d.allowedTools.length === 0) {
      issues.push({ severity: 'info', nodeId: agent.id, message: `Agent "${d.name}" has no tool restrictions. Consider limiting tools for safety.` });
    }
  }

  // Check cycles
  const cycles = detectCycles(nodes, edges);
  for (const cycle of cycles) {
    issues.push({ severity: 'error', message: `Cycle detected: ${cycle.join(' \u2192 ')}` });
  }

  const score = issues.some(i => i.severity === 'error') ? 'issues'
    : issues.some(i => i.severity === 'warning') ? 'warnings'
    : 'healthy';

  return { score, issues };
}
