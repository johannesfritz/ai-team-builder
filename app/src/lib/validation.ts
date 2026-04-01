import type { PluginNodeType } from './plugin-types';

export interface ValidationResult {
  valid: boolean;
  errors: FieldIssue[];
  warnings: FieldIssue[];
}

export interface FieldIssue {
  field: string;
  message: string;
}

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

function isValidGlob(pattern: string): boolean {
  if (!pattern) return true;
  try {
    // Basic glob validation: check for unmatched brackets
    let bracketDepth = 0;
    for (const ch of pattern) {
      if (ch === '[') bracketDepth++;
      if (ch === ']') bracketDepth--;
      if (bracketDepth < 0) return false;
    }
    return bracketDepth === 0;
  } catch {
    return false;
  }
}

function isValidRegex(pattern: string): boolean {
  if (!pattern) return true;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

const validators: Record<PluginNodeType, (data: Record<string, unknown>) => ValidationResult> = {
  rule: (data) => {
    const errors: FieldIssue[] = [];
    const warnings: FieldIssue[] = [];

    if (!data.name) errors.push({ field: 'name', message: 'Rule name is required' });
    else if (!KEBAB_CASE.test(data.name as string)) warnings.push({ field: 'name', message: 'Use kebab-case (e.g., code-standards)' });

    if (!data.content) warnings.push({ field: 'content', message: 'Rule has no content yet' });

    if (data.pathFilter && !isValidGlob(data.pathFilter as string)) {
      errors.push({ field: 'pathFilter', message: 'Invalid glob pattern' });
    }

    if (!data.pathFilter && data.content && estimateTokens(data.content as string) > 250) {
      warnings.push({ field: 'pathFilter', message: 'Large rule without path filter loads every session (~' + estimateTokens(data.content as string) + ' tokens). Add a path filter to scope it.' });
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  hook: (data) => {
    const errors: FieldIssue[] = [];
    const warnings: FieldIssue[] = [];

    if (!data.event) errors.push({ field: 'event', message: 'Hook event is required' });
    if (!data.matcher) warnings.push({ field: 'matcher', message: 'No matcher — hook will match all tools' });
    else if (!isValidRegex(data.matcher as string)) errors.push({ field: 'matcher', message: 'Invalid regex pattern' });

    if (!data.action) warnings.push({ field: 'action', message: 'No action set. Connect this hook to a rule or skill via an edge, or set an action manually.' });

    if (!data.once && data.event === 'PreToolUse') {
      warnings.push({ field: 'once', message: 'Consider "once per session" for PreToolUse hooks to avoid duplicate loading' });
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  skill: (data) => {
    const errors: FieldIssue[] = [];
    const warnings: FieldIssue[] = [];

    if (!data.name) errors.push({ field: 'name', message: 'Skill name is required' });
    else if (!KEBAB_CASE.test(data.name as string)) warnings.push({ field: 'name', message: 'Use kebab-case (e.g., run-tests)' });

    if (!data.description) warnings.push({ field: 'description', message: 'Include trigger phrases so Claude knows when to invoke this skill' });

    if (data.filePattern && !isValidGlob(data.filePattern as string)) {
      errors.push({ field: 'filePattern', message: 'Invalid glob pattern' });
    }

    if (data.bashPattern && !isValidRegex(data.bashPattern as string)) {
      errors.push({ field: 'bashPattern', message: 'Invalid regex pattern' });
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  command: (data) => {
    const errors: FieldIssue[] = [];
    const warnings: FieldIssue[] = [];

    if (!data.name) errors.push({ field: 'name', message: 'Command name is required' });
    else {
      if ((data.name as string).startsWith('/')) errors.push({ field: 'name', message: 'Do not include the leading /' });
      if (!KEBAB_CASE.test(data.name as string)) warnings.push({ field: 'name', message: 'Use kebab-case (e.g., run-review)' });
    }

    if (!data.prompt) warnings.push({ field: 'prompt', message: 'Command has no prompt template yet' });

    return { valid: errors.length === 0, errors, warnings };
  },

  agent: (data) => {
    const errors: FieldIssue[] = [];
    const warnings: FieldIssue[] = [];

    if (!data.name) errors.push({ field: 'name', message: 'Agent name is required' });
    else if (!KEBAB_CASE.test(data.name as string)) warnings.push({ field: 'name', message: 'Use kebab-case (e.g., code-reviewer)' });

    if (!data.model) errors.push({ field: 'model', message: 'Model selection is required' });

    if (!data.systemPrompt) warnings.push({ field: 'systemPrompt', message: 'Agent has no system prompt — describe its role and constraints' });

    const tools = data.allowedTools as string[] | undefined;
    if (!tools || tools.length === 0) {
      warnings.push({ field: 'allowedTools', message: 'No tool restrictions — agent can use all tools. Consider restricting for safety.' });
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  mcp: (data) => {
    const errors: FieldIssue[] = [];
    const warnings: FieldIssue[] = [];

    if (!data.serverName) errors.push({ field: 'serverName', message: 'Server name is required' });
    if (!data.command) errors.push({ field: 'command', message: 'Command is required (e.g., node, python3)' });

    return { valid: errors.length === 0, errors, warnings };
  },
};

export function validateNode(type: PluginNodeType, data: Record<string, unknown>): ValidationResult {
  const validator = validators[type];
  if (!validator) return { valid: true, errors: [], warnings: [] };
  return validator(data);
}

export type NodeHealth = 'valid' | 'warning' | 'error';

export function getNodeHealth(type: PluginNodeType, data: Record<string, unknown>): NodeHealth {
  const result = validateNode(type, data);
  if (result.errors.length > 0) return 'error';
  if (result.warnings.length > 0) return 'warning';
  return 'valid';
}
