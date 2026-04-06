import type { Node, Edge } from '@xyflow/react';
import { NODE_COLORS, type PluginNodeType } from './plugin-types';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: Node[];
  edges: Edge[];
}

function edge(id: string, source: string, target: string, sourceType: PluginNodeType): Edge {
  return { id, source, target, animated: true, style: { stroke: NODE_COLORS[sourceType] } };
}

export const TEMPLATES: Template[] = [
  {
    id: 'code-review',
    name: 'Code Review Standards',
    description: 'Enforce code quality with hooks on Edit/Write and a standards rule.',
    category: 'Quality',
    nodes: [
      { id: 'h1', type: 'hook', position: { x: 50, y: 50 }, data: { label: 'Pre-Edit Check', event: 'PreToolUse', matcher: 'Edit|Write', action: '', once: true } },
      { id: 'r1', type: 'rule', position: { x: 400, y: 30 }, data: { label: 'Code Standards', name: 'code-standards', pathFilter: '**/*.py', content: '# Code Standards\n\n- Complete type hints on all functions\n- Async everywhere (no sync in async context)\n- No wildcard imports\n- Handle errors explicitly' } },
      { id: 'c1', type: 'command', position: { x: 400, y: 200 }, data: { label: '/review', name: 'review', description: 'Run code review', prompt: 'Review the current file for:\n1. Type safety issues\n2. Error handling gaps\n3. Security vulnerabilities\n4. Style violations' } },
    ],
    edges: [edge('e1', 'h1', 'r1', 'hook')],
  },
  {
    id: 'git-discipline',
    name: 'Git Discipline',
    description: 'Enforce commit message standards and prevent dirty repos.',
    category: 'DevOps',
    nodes: [
      { id: 'h1', type: 'hook', position: { x: 50, y: 50 }, data: { label: 'Pre-Commit Check', event: 'PreToolUse', matcher: 'Bash', action: '', once: false } },
      { id: 'r1', type: 'rule', position: { x: 400, y: 30 }, data: { label: 'Commit Standards', name: 'commit-standards', pathFilter: '', content: '# Commit Standards\n\n- Use conventional commits: feat:, fix:, refactor:, docs:\n- One logical change per commit\n- Never commit .env files or secrets\n- Push after every commit session' } },
      { id: 'c1', type: 'command', position: { x: 400, y: 200 }, data: { label: '/commit', name: 'commit', description: 'Stage and commit changes', prompt: 'Review all unstaged changes. Stage relevant files. Write a conventional commit message.\n\nFormat: type(scope): description\n\nTypes: feat, fix, refactor, docs, test, chore' } },
    ],
    edges: [edge('e1', 'h1', 'r1', 'hook')],
  },
  {
    id: 'agent-pipeline',
    name: 'Multi-Agent Pipeline',
    description: 'Agent team with researcher and implementer roles sharing skills.',
    category: 'Agents',
    nodes: [
      { id: 'a1', type: 'agent', position: { x: 50, y: 50 }, data: { label: 'Researcher', name: 'researcher', model: 'sonnet', systemPrompt: 'You research codebases and documentation. Find relevant code, patterns, and context before implementation begins.', allowedTools: ['Read', 'Grep', 'Glob', 'WebSearch'] } },
      { id: 'a2', type: 'agent', position: { x: 50, y: 250 }, data: { label: 'Implementer', name: 'implementer', model: 'sonnet', systemPrompt: 'You implement code changes based on research findings. Write clean, tested code following project standards.', allowedTools: ['Read', 'Edit', 'Write', 'Bash'] } },
      { id: 's1', type: 'skill', position: { x: 400, y: 50 }, data: { label: 'Codebase Analysis', name: 'codebase-analysis', description: 'Analyze project structure and patterns', instructions: '# Codebase Analysis\n\n1. Read the project README and CLAUDE.md\n2. Identify the tech stack\n3. Map the directory structure\n4. Find relevant files for the task', filePattern: '', bashPattern: '' } },
      { id: 's2', type: 'skill', position: { x: 400, y: 250 }, data: { label: 'Implementation', name: 'implement', description: 'Write and test code changes', instructions: '# Implementation\n\n1. Read the research findings\n2. Plan the changes\n3. Implement in small steps\n4. Run tests after each change\n5. Commit when tests pass', filePattern: '', bashPattern: '' } },
    ],
    edges: [
      edge('e1', 'a1', 's1', 'agent'),
      edge('e2', 'a2', 's2', 'agent'),
    ],
  },
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    description: 'Pre-commit security checks for common vulnerabilities.',
    category: 'Security',
    nodes: [
      { id: 'h1', type: 'hook', position: { x: 50, y: 50 }, data: { label: 'Pre-Write Security', event: 'PreToolUse', matcher: 'Write|Edit', action: '', once: true } },
      { id: 'r1', type: 'rule', position: { x: 400, y: 30 }, data: { label: 'Security Rules', name: 'security-rules', pathFilter: '', content: '# Security Rules\n\nBefore writing code, verify:\n- No hardcoded secrets (API keys, passwords, tokens)\n- No SQL injection (use parameterized queries)\n- No path traversal (validate file paths)\n- No XSS (sanitize user input)\n- No command injection (never pass user input to shell)\n- Validate all external input at system boundaries' } },
      { id: 'h2', type: 'hook', position: { x: 50, y: 200 }, data: { label: 'Post-Write Audit', event: 'PostToolUse', matcher: 'Write|Edit', action: '', once: false } },
      { id: 's1', type: 'skill', position: { x: 400, y: 200 }, data: { label: 'Security Audit', name: 'security-audit', description: 'Run security checks on changed files', instructions: '# Security Audit\n\nAfter code changes, scan for:\n1. Hardcoded credentials\n2. SQL injection patterns\n3. Unsafe deserialization\n4. Missing input validation\n5. Insecure dependencies', filePattern: '**/*.{py,ts,js}', bashPattern: '' } },
    ],
    edges: [
      edge('e1', 'h1', 'r1', 'hook'),
      edge('e2', 'h2', 's1', 'hook'),
    ],
  },
  {
    id: 'api-integration',
    name: 'API Integration',
    description: 'MCP server connection with a skill for API usage.',
    category: 'Integration',
    nodes: [
      { id: 'm1', type: 'mcp', position: { x: 50, y: 50 }, data: { label: 'External API', serverName: 'my-api', command: 'node', args: ['dist/server.js'], env: {} } },
      { id: 's1', type: 'skill', position: { x: 50, y: 250 }, data: { label: 'API Usage Guide', name: 'api-guide', description: 'How to use the connected API', instructions: '# API Usage\n\nThis plugin connects to an external API via MCP.\n\n## Available Tools\n- `search` — Search the API\n- `get` — Get a specific resource\n- `create` — Create a new resource\n\n## Usage\nCall the MCP tools directly. Results are returned as JSON.', filePattern: '', bashPattern: '' } },
      { id: 'c1', type: 'command', position: { x: 400, y: 250 }, data: { label: '/api-search', name: 'api-search', description: 'Search the connected API', prompt: 'Use the MCP search tool to find resources matching the user\'s query. Format results as a table.' } },
    ],
    edges: [
      edge('e1', 's1', 'c1', 'skill'),
    ],
  },
];
