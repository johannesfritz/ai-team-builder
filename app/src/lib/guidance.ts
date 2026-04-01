// Inline help text and guidance sourced from Claude Code documentation + configuration handbook

import type { PluginNodeType } from './plugin-types';

export interface FieldGuidance {
  label: string;
  required: boolean;
  help: string;
  example?: string;
  placeholder?: string;
}

export interface TypeGuidance {
  what: string;
  when: string;
  tip: string;
  fields: Record<string, FieldGuidance>;
}

export const GUIDANCE: Record<PluginNodeType, TypeGuidance> = {
  rule: {
    what: 'A rule is context that automatically loads at session start. It tells Claude what standards to follow.',
    when: 'Use rules for coding standards, naming conventions, or domain knowledge that should always be present.',
    tip: 'Use the paths: frontmatter to scope when this rule loads. Without it, every session pays the token cost. Keep unfiltered rules under 1KB.',
    fields: {
      name: { label: 'Rule Name', required: true, help: 'Unique identifier in kebab-case. This becomes the filename.', example: 'code-standards', placeholder: 'e.g. code-standards' },
      pathFilter: { label: 'Path Filter', required: false, help: 'Glob pattern — rule only loads when editing matching files. Without this, the rule loads every session.', example: '**/*.py', placeholder: 'e.g. **/*.py' },
      content: { label: 'Content', required: false, help: 'Markdown content. Write clear, actionable rules. Use bullet points for standards.', example: '# Code Standards\n\n- All functions must have type hints\n- Use async/await for IO operations', placeholder: '# Rule content...' },
    },
  },

  hook: {
    what: 'A hook intercepts events (tool calls, prompts, agent spawns) and injects context or blocks actions.',
    when: 'Use hooks to inject rules before edits, validate output after writes, or add context when agents start.',
    tip: 'Use once: true to prevent the same content loading repeatedly. PreToolUse hooks can block operations (exit code 2). PostToolUse hooks cannot block.',
    fields: {
      event: { label: 'Event', required: true, help: 'When the hook fires. PreToolUse fires before a tool runs (can block). PostToolUse fires after.', placeholder: 'PreToolUse' },
      matcher: { label: 'Matcher', required: false, help: 'Tool name pattern (regex). Use pipe for multiple: Edit|Write. Leave empty to match all tools.', example: 'Edit|Write', placeholder: 'e.g. Edit|Write' },
      action: { label: 'Action', required: false, help: 'Shell command to run. If empty, the action is auto-generated from connected edges (recommended).', example: 'cat "${CLAUDE_PLUGIN_ROOT}/rules/my-rule.md"', placeholder: 'Auto-generated from edges' },
      once: { label: 'Once per session', required: false, help: 'If enabled, fires only once per session. Prevents the same protocol from loading on every Edit.', placeholder: '' },
    },
  },

  skill: {
    what: 'A skill is a reusable expertise module that Claude can invoke contextually or via a slash command.',
    when: 'Use skills for procedures, checklists, or domain expertise that Claude should follow in specific situations.',
    tip: 'Include 3-5 trigger phrases in the description so Claude knows when to invoke this skill automatically.',
    fields: {
      name: { label: 'Skill Name', required: true, help: 'Unique identifier in kebab-case. This becomes the directory name.', example: 'run-tests', placeholder: 'e.g. run-tests' },
      description: { label: 'Description', required: false, help: 'When should Claude use this skill? Include trigger phrases: "when the user asks to run tests" or "after editing Python files".', example: 'Use when the user asks to run tests, verify code, or check for regressions', placeholder: 'When should this skill be used?' },
      filePattern: { label: 'File Pattern', required: false, help: 'Glob pattern — skill activates when editing matching files.', example: '**/*.py', placeholder: 'e.g. **/*.py' },
      bashPattern: { label: 'Bash Pattern', required: false, help: 'Regex — skill activates when matching bash commands run.', example: 'pytest|npm test', placeholder: 'e.g. pytest|npm test' },
      instructions: { label: 'Instructions', required: false, help: 'Markdown with step-by-step procedure. This is what Claude follows when the skill is active.', placeholder: '# Instructions\n\n1. First step...' },
    },
  },

  command: {
    what: 'A slash command is a user-invocable action. Users type /your-command and Claude follows the prompt template.',
    when: 'Use commands for repeatable workflows: /review, /deploy, /test, /commit.',
    tip: 'The command name is what users type after /. Use kebab-case. The prompt template is the full instruction Claude receives.',
    fields: {
      name: { label: 'Command Name', required: true, help: 'What users type after /. Use kebab-case, no leading slash.', example: 'review', placeholder: 'e.g. review' },
      description: { label: 'Description', required: false, help: 'Brief description shown in command help.', placeholder: 'What does this command do?' },
      prompt: { label: 'Prompt Template', required: false, help: 'Full markdown instruction. This is what Claude sees when the user invokes the command.', example: 'Review the current file for:\n1. Type safety\n2. Error handling\n3. Security issues', placeholder: 'Write the instructions Claude should follow...' },
    },
  },

  agent: {
    what: 'An agent is a specialized sub-worker for a specific task. Agents have their own model, tools, and system prompt.',
    when: 'Use agents for distinct roles: researcher, implementer, reviewer, tester. Each agent focuses on one responsibility.',
    tip: 'Use model: inherit unless you need Haiku for speed or Opus for deep reasoning. Always restrict tools explicitly for safety.',
    fields: {
      name: { label: 'Agent Name', required: true, help: 'Use role descriptors: researcher, reviewer, implementer. Kebab-case.', example: 'code-reviewer', placeholder: 'e.g. code-reviewer' },
      model: { label: 'Model', required: true, help: 'Haiku = fast/cheap. Sonnet = balanced. Opus = most capable. Inherit = use parent model.', placeholder: 'sonnet' },
      systemPrompt: { label: 'System Prompt', required: false, help: 'Describe the agent\'s role, constraints, and approach. Be specific about what it should and shouldn\'t do.', example: 'You are a senior code reviewer. Focus on security vulnerabilities, type safety, and error handling. Do not modify code directly.', placeholder: 'Describe this agent\'s role...' },
      allowedTools: { label: 'Allowed Tools', required: false, help: 'Restrict which tools this agent can use. Common tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch.', example: 'Read, Grep, Glob, Bash', placeholder: 'e.g. Read, Grep, Glob' },
    },
  },

  mcp: {
    what: 'An MCP (Model Context Protocol) config connects Claude to an external tool server — APIs, databases, or services.',
    when: 'Use MCP to give Claude access to external APIs, databases, or custom tools not built into Claude Code.',
    tip: 'Use ${CLAUDE_PLUGIN_ROOT} for portable paths. Keep API keys in environment variables, not in the config file.',
    fields: {
      serverName: { label: 'Server Name', required: true, help: 'Unique identifier for this MCP server. Used to reference its tools.', example: 'my-api', placeholder: 'e.g. my-api' },
      command: { label: 'Command', required: true, help: 'Executable to start the MCP server.', example: 'node', placeholder: 'e.g. node, python3' },
      args: { label: 'Arguments', required: false, help: 'Command arguments, comma-separated.', example: 'dist/server.js', placeholder: 'e.g. dist/server.js' },
      env: { label: 'Environment', required: false, help: 'Environment variables passed to the server. Use for API keys and configuration.', placeholder: 'KEY=value' },
    },
  },
};
