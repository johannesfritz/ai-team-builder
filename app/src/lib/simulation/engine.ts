// Structural dry run simulation engine
// No LLM calls — traces which components would fire based on event matching

import type { Node, Edge } from '@xyflow/react';
import picomatch from 'picomatch';
import type { RuleData, HookData, SkillData, CommandData, PluginNodeType } from '../plugin-types';

export interface SimulationStep {
  stepNumber: number;
  event: string;
  description: string;
  firedComponents: FiredComponent[];
}

export interface FiredComponent {
  nodeId: string;
  nodeType: PluginNodeType;
  name: string;
  reason: string;
  tokenEstimate: number;
}

export interface SimulationResult {
  steps: SimulationStep[];
  totalTokens: number;
  componentsUsed: number;
  componentsTotal: number;
}

interface SimulationInput {
  prompt: string;
  toolUsed?: string;     // e.g. "Edit"
  filePath?: string;     // e.g. "src/app.py"
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function matchesGlob(pattern: string, path: string): boolean {
  if (!pattern || !path) return false;
  try {
    return picomatch.isMatch(path, pattern);
  } catch {
    return false;
  }
}

function matchesTool(matcher: string, tool: string): boolean {
  if (!matcher || !tool) return false;
  try {
    return new RegExp(`^(${matcher})$`).test(tool);
  } catch {
    return matcher.split('|').some(m => m.trim() === tool);
  }
}

export function simulate(nodes: Node[], edges: Edge[], input: SimulationInput): SimulationResult {
  const steps: SimulationStep[] = [];
  const firedNodeIds = new Set<string>();
  let totalTokens = 0;

  // Step 1: Session starts — which rules auto-load?
  const ruleNodes = nodes.filter(n => n.type === 'rule');
  const sessionRules: FiredComponent[] = [];

  for (const ruleNode of ruleNodes) {
    const d = ruleNode.data as unknown as RuleData;
    const hasPathFilter = !!d.pathFilter;
    const pathMatches = input.filePath ? matchesGlob(d.pathFilter, input.filePath) : false;

    if (!hasPathFilter || pathMatches) {
      const tokens = estimateTokens(d.content || '');
      totalTokens += tokens;
      firedNodeIds.add(ruleNode.id);
      sessionRules.push({
        nodeId: ruleNode.id,
        nodeType: 'rule',
        name: d.name || 'unnamed',
        reason: hasPathFilter
          ? `Path filter "${d.pathFilter}" matched "${input.filePath}"`
          : 'No path filter — always loads',
        tokenEstimate: tokens,
      });
    }
  }

  steps.push({
    stepNumber: 1,
    event: 'Session starts',
    description: 'Rules are loaded based on file context',
    firedComponents: sessionRules,
  });

  // Step 2: Tool invocation — which hooks fire?
  if (input.toolUsed) {
    const hookNodes = nodes.filter(n => n.type === 'hook');
    const toolHooks: FiredComponent[] = [];

    for (const hookNode of hookNodes) {
      const d = hookNode.data as unknown as HookData;
      if (d.event !== 'PreToolUse' && d.event !== 'PostToolUse') continue;

      const toolMatches = matchesTool(d.matcher, input.toolUsed);
      if (!toolMatches) continue;

      // Find connected targets for token estimation
      const connectedEdges = edges.filter(e => e.source === hookNode.id);
      const targetNodes = connectedEdges.map(e => nodes.find(n => n.id === e.target)).filter(Boolean);

      let injectedTokens = 0;
      const injectedNames: string[] = [];
      for (const target of targetNodes) {
        if (!target) continue;
        if (target.type === 'rule') {
          const rd = target.data as unknown as RuleData;
          injectedTokens += estimateTokens(rd.content || '');
          injectedNames.push(`rule:${rd.name}`);
          firedNodeIds.add(target.id);
        } else if (target.type === 'skill') {
          const sd = target.data as unknown as SkillData;
          injectedTokens += estimateTokens(sd.instructions || '');
          injectedNames.push(`skill:${sd.name}`);
          firedNodeIds.add(target.id);
        }
      }

      totalTokens += injectedTokens;
      firedNodeIds.add(hookNode.id);

      toolHooks.push({
        nodeId: hookNode.id,
        nodeType: 'hook',
        name: `${d.event}: ${d.matcher}`,
        reason: `Matcher "${d.matcher}" matched tool "${input.toolUsed}"${
          injectedNames.length > 0 ? ` → injects ${injectedNames.join(', ')}` : ''
        }${d.once ? ' (once per session)' : ''}`,
        tokenEstimate: injectedTokens,
      });
    }

    steps.push({
      stepNumber: 2,
      event: `Claude uses ${input.toolUsed}${input.filePath ? ` on ${input.filePath}` : ''}`,
      description: 'Hooks fire based on tool matcher',
      firedComponents: toolHooks,
    });
  }

  // Step 3: Available commands
  const commandNodes = nodes.filter(n => n.type === 'command');
  const commands: FiredComponent[] = [];

  for (const cmdNode of commandNodes) {
    const d = cmdNode.data as unknown as CommandData;
    const tokens = estimateTokens(d.prompt || '');
    firedNodeIds.add(cmdNode.id);
    commands.push({
      nodeId: cmdNode.id,
      nodeType: 'command',
      name: `/${d.name || 'untitled'}`,
      reason: 'Registered as slash command',
      tokenEstimate: tokens,
    });
  }

  steps.push({
    stepNumber: input.toolUsed ? 3 : 2,
    event: 'Commands available',
    description: 'Slash commands registered by this plugin',
    firedComponents: commands,
  });

  // Step 4: Skills matched by file/bash patterns
  const skillNodes = nodes.filter(n => n.type === 'skill' && !firedNodeIds.has(n.id));
  const matchedSkills: FiredComponent[] = [];

  for (const skillNode of skillNodes) {
    const d = skillNode.data as unknown as SkillData;
    const fileMatches = input.filePath && d.filePattern ? matchesGlob(d.filePattern, input.filePath) : false;

    if (fileMatches) {
      const tokens = estimateTokens(d.instructions || '');
      totalTokens += tokens;
      firedNodeIds.add(skillNode.id);
      matchedSkills.push({
        nodeId: skillNode.id,
        nodeType: 'skill',
        name: d.name || 'unnamed',
        reason: `File pattern "${d.filePattern}" matched "${input.filePath}"`,
        tokenEstimate: tokens,
      });
    }
  }

  if (matchedSkills.length > 0) {
    steps.push({
      stepNumber: steps.length + 1,
      event: 'Skills matched',
      description: 'Skills triggered by file/bash patterns',
      firedComponents: matchedSkills,
    });
  }

  return {
    steps,
    totalTokens,
    componentsUsed: firedNodeIds.size,
    componentsTotal: nodes.length,
  };
}
