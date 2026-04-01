// BotCamp Plugin Schema — maps to .claude-plugin/ directory structure

export type PluginNodeType = 'rule' | 'hook' | 'skill' | 'command' | 'agent';

export interface RuleData {
  label: string;
  name: string;
  pathFilter: string; // glob pattern, e.g. "**/*.py"
  content: string; // markdown
}

export interface HookData {
  label: string;
  event: 'PreToolUse' | 'PostToolUse' | 'UserPromptSubmit' | 'SubagentStart' | 'SessionStart';
  matcher: string; // regex or tool name, e.g. "Edit|Write"
  action: string; // shell command or file reference
  once: boolean;
}

export interface SkillData {
  label: string;
  name: string;
  description: string;
  instructions: string; // markdown
  filePattern: string; // glob
  bashPattern: string; // regex
}

export interface CommandData {
  label: string;
  name: string; // slash command name
  description: string;
  prompt: string; // markdown template
}

export interface AgentData {
  label: string;
  name: string;
  model: string;
  systemPrompt: string;
  allowedTools: string[];
}

export type PluginData = RuleData | HookData | SkillData | CommandData | AgentData;

// Valid edge connections: source type -> allowed target types
export const VALID_CONNECTIONS: Record<PluginNodeType, PluginNodeType[]> = {
  hook: ['rule', 'skill'],       // hooks inject rules or trigger skills
  agent: ['skill'],              // agents use skills
  skill: ['command'],            // skills invoke commands
  rule: [],                      // rules don't connect to anything
  command: [],                   // commands are leaf nodes
};

// Node colors
export const NODE_COLORS: Record<PluginNodeType, string> = {
  rule: '#3b82f6',     // blue
  hook: '#f97316',     // orange
  skill: '#22c55e',    // green
  command: '#a855f7',  // purple
  agent: '#ef4444',    // red
};
