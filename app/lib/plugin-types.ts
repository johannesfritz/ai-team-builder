// AI Team Builder Plugin Schema — maps to .claude-plugin/ directory structure

export type PluginNodeType = 'rule' | 'hook' | 'skill' | 'command' | 'agent' | 'mcp';

export interface RuleData {
  label: string;
  name: string;
  pathFilter: string;
  content: string;
}

export interface HookData {
  label: string;
  event: 'PreToolUse' | 'PostToolUse' | 'UserPromptSubmit' | 'SubagentStart' | 'SessionStart';
  matcher: string;
  action: string;
  once: boolean;
}

export interface SkillData {
  label: string;
  name: string;
  description: string;
  instructions: string;
  filePattern: string;
  bashPattern: string;
}

export interface CommandData {
  label: string;
  name: string;
  description: string;
  prompt: string;
}

export interface AgentData {
  label: string;
  name: string;
  model: string;
  systemPrompt: string;
  allowedTools: string[];
}

export interface McpData {
  label: string;
  serverName: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export type PluginData = RuleData | HookData | SkillData | CommandData | AgentData | McpData;

// Valid edge connections: source type -> allowed target types
export const VALID_CONNECTIONS: Record<PluginNodeType, PluginNodeType[]> = {
  hook: ['rule', 'skill'],
  agent: ['skill'],
  skill: ['command'],
  rule: [],
  command: [],
  mcp: [],
};

export const NODE_COLORS: Record<PluginNodeType, string> = {
  rule: '#3b82f6',
  hook: '#f97316',
  skill: '#22c55e',
  command: '#a855f7',
  agent: '#ef4444',
  mcp: '#6b7280',
};

export const NODE_LABELS: Record<PluginNodeType, string> = {
  rule: 'Rule',
  hook: 'Hook',
  skill: 'Skill',
  command: 'Command',
  agent: 'Agent',
  mcp: 'MCP Config',
};
