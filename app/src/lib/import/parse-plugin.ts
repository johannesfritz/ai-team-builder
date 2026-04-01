// Parse a .claude-plugin/ directory structure into React Flow nodes and edges
// Input: array of { path: string, content: string } files
// Output: nodes and edges for the builder canvas

import type { Node, Edge } from '@xyflow/react';
import { NODE_COLORS, type PluginNodeType } from '../plugin-types';

interface ImportFile {
  path: string;
  content: string;
}

interface ImportResult {
  nodes: Node[];
  edges: Edge[];
  warnings: string[];
}

let nodeCounter = 0;
function nextId(type: string): string {
  return `${type}-import-${++nodeCounter}`;
}

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const fm: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?([^"]*)"?$/);
    if (kv) fm[kv[1]] = kv[2];
  }
  return { frontmatter: fm, body: match[2].trim() };
}

function parsePathsList(content: string): string {
  const match = content.match(/paths:\n((?:\s+-\s+"[^"]+"\n?)+)/);
  if (!match) return '';
  const paths = match[1].match(/"([^"]+)"/g);
  return paths ? paths.map(p => p.replace(/"/g, '')).join(', ') : '';
}

export function parsePluginFiles(files: ImportFile[]): ImportResult {
  nodeCounter = 0;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const warnings: string[] = [];

  let yOffset = 50;
  const ruleX = 400;
  const hookX = 50;
  const skillX = 400;
  const commandX = 700;

  // Parse rules
  const ruleFiles = files.filter(f => f.path.startsWith('rules/') && f.path.endsWith('.md'));
  for (const file of ruleFiles) {
    const name = file.path.replace('rules/', '').replace('.md', '');
    const { body } = parseFrontmatter(file.content);
    const pathFilter = parsePathsList(file.content);

    nodes.push({
      id: nextId('rule'),
      type: 'rule',
      position: { x: ruleX, y: yOffset },
      data: { label: name, name, pathFilter, content: body },
    });
    yOffset += 150;
  }

  // Parse skills
  const skillFiles = files.filter(f => f.path.match(/^skills\/[^/]+\/SKILL\.md$/));
  for (const file of skillFiles) {
    const name = file.path.replace('skills/', '').replace('/SKILL.md', '');
    const { frontmatter, body } = parseFrontmatter(file.content);

    nodes.push({
      id: nextId('skill'),
      type: 'skill',
      position: { x: skillX, y: yOffset },
      data: {
        label: name,
        name,
        description: frontmatter.description || '',
        instructions: body,
        filePattern: frontmatter.filePattern || '',
        bashPattern: frontmatter.bashPattern || '',
      },
    });
    yOffset += 150;
  }

  // Parse commands
  const commandFiles = files.filter(f => f.path.startsWith('commands/') && f.path.endsWith('.md'));
  for (const file of commandFiles) {
    const name = file.path.replace('commands/', '').replace('.md', '');
    // Extract description from first non-heading paragraph
    const descMatch = file.content.match(/^(?:#[^\n]+\n+)?([^\n#][^\n]{10,})/);
    const description = descMatch ? descMatch[1].substring(0, 100) : '';
    nodes.push({
      id: nextId('command'),
      type: 'command',
      position: { x: commandX, y: yOffset },
      data: { label: `/${name}`, name, description, prompt: file.content },
    });
    yOffset += 150;
  }

  // Parse agents
  const agentFiles = files.filter(f => f.path.startsWith('agents/') && f.path.endsWith('.md'));
  for (const file of agentFiles) {
    const name = file.path.replace('agents/', '').replace('.md', '');

    // Try structured format first, fall back to treating entire content as system prompt
    const modelMatch = file.content.match(/\*\*Model:\*\*\s*(\S+)/);
    const toolsMatch = file.content.match(/## Allowed Tools\n((?:- .+\n?)+)/);
    const promptMatch = file.content.match(/## System Prompt\n\n([\s\S]*?)(?=\n## |$)/);

    // Also try frontmatter format (model: sonnet, tools: Read, Grep)
    const { frontmatter, body } = parseFrontmatter(file.content);
    const fmModel = frontmatter.model;
    const fmTools = frontmatter.tools;

    const tools = toolsMatch
      ? toolsMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.replace('- ', '').trim())
      : fmTools ? fmTools.split(',').map(t => t.trim()) : [];

    // Use structured system prompt if found, otherwise use the full body content
    const systemPrompt = promptMatch?.[1]?.trim() || body || file.content.replace(/^# .+\n/, '').trim();

    nodes.push({
      id: nextId('agent'),
      type: 'agent',
      position: { x: hookX, y: yOffset },
      data: {
        label: name,
        name,
        model: modelMatch?.[1] || fmModel || 'inherit',
        systemPrompt,
        allowedTools: tools,
      },
    });
    yOffset += 150;
  }

  // Parse hooks from hooks.json
  const hooksFile = files.find(f => f.path === 'hooks/hooks.json');
  if (hooksFile) {
    try {
      const hooksConfig = JSON.parse(hooksFile.content);
      let hookY = 50;

      for (const [event, entries] of Object.entries(hooksConfig)) {
        if (!Array.isArray(entries)) continue;
        for (const entry of entries as Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>) {
          const hookId = nextId('hook');
          const action = entry.hooks?.[0]?.command || '';

          nodes.push({
            id: hookId,
            type: 'hook',
            position: { x: hookX, y: hookY },
            data: {
              label: `${event}: ${entry.matcher}`,
              event,
              matcher: entry.matcher,
              action,
              once: false,
            },
          });

          // Try to connect hook to the rule/skill it references
          const refMatch = action.match(/(?:rules|skills)\/([^/."]+)/);
          if (refMatch) {
            const refName = refMatch[1];
            const target = nodes.find(n =>
              (n.type === 'rule' || n.type === 'skill') &&
              (n.data as { name: string }).name === refName
            );
            if (target) {
              edges.push({
                id: `edge-${hookId}-${target.id}`,
                source: hookId,
                target: target.id,
                animated: true,
                style: { stroke: NODE_COLORS.hook },
              });
            }
          }

          hookY += 150;
        }
      }
    } catch {
      warnings.push('Could not parse hooks/hooks.json');
    }
  }

  if (nodes.length === 0) {
    warnings.push('No plugin components found. Expected files in rules/, skills/, commands/, agents/, or hooks/hooks.json');
  }

  return { nodes, edges, warnings };
}
