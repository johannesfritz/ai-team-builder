import type { Node, Edge } from '@xyflow/react';
import type { RuleData, HookData, SkillData, CommandData, AgentData, McpData, PluginNodeType } from '../plugin-types';

export interface PluginFile {
  path: string;
  content: string;
}

export interface SerializationResult {
  files: PluginFile[];
  errors: string[];
  tokenEstimate: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function serializeGraph(
  nodes: Node[],
  edges: Edge[],
  pluginName: string = 'my-plugin',
  pluginVersion: string = '1.0.0',
  pluginDescription: string = '',
): SerializationResult {
  const files: PluginFile[] = [];
  const errors: string[] = [];
  let totalTokens = 0;

  files.push({
    path: 'plugin.json',
    content: JSON.stringify({
      name: pluginName,
      version: pluginVersion,
      description: pluginDescription,
      author: '',
    }, null, 2),
  });

  for (const node of nodes) {
    const type = node.type as PluginNodeType;

    switch (type) {
      case 'rule': {
        const d = node.data as unknown as RuleData;
        if (!d.name) { errors.push(`Rule node "${d.label}" has no name`); continue; }
        let content = '';
        if (d.pathFilter) {
          content += `---\npaths:\n  - "${d.pathFilter}"\n---\n\n`;
        }
        content += d.content || `# ${d.name}`;
        totalTokens += estimateTokens(content);
        files.push({ path: `rules/${d.name}.md`, content });
        break;
      }

      case 'skill': {
        const d = node.data as unknown as SkillData;
        if (!d.name) { errors.push(`Skill node "${d.label}" has no name`); continue; }
        const fm: string[] = ['---'];
        if (d.description) fm.push(`description: "${d.description}"`);
        if (d.filePattern) fm.push(`filePattern: "${d.filePattern}"`);
        if (d.bashPattern) fm.push(`bashPattern: "${d.bashPattern}"`);
        fm.push('---\n');
        const content = fm.join('\n') + (d.instructions || `# ${d.name}`);
        totalTokens += estimateTokens(content);
        files.push({ path: `skills/${d.name}/SKILL.md`, content });
        break;
      }

      case 'command': {
        const d = node.data as unknown as CommandData;
        if (!d.name) { errors.push(`Command node "${d.label}" has no name`); continue; }
        const content = d.prompt || `# ${d.name}`;
        totalTokens += estimateTokens(content);
        files.push({ path: `commands/${d.name}.md`, content });
        break;
      }

      case 'agent': {
        const d = node.data as unknown as AgentData;
        if (!d.name) { errors.push(`Agent node "${d.label}" has no name`); continue; }
        let content = `# ${d.name}\n\n`;
        if (d.model) content += `**Model:** ${d.model}\n\n`;
        if (d.systemPrompt) content += `## System Prompt\n\n${d.systemPrompt}\n\n`;
        if (d.allowedTools?.length) content += `## Allowed Tools\n\n${d.allowedTools.map(t => `- ${t}`).join('\n')}\n`;
        totalTokens += estimateTokens(content);
        files.push({ path: `agents/${d.name}.md`, content });
        break;
      }

      case 'mcp': {
        // MCP configs are collected into .mcp.json below
        break;
      }

      case 'hook':
        // Hooks are collected into hooks/hooks.json below
        break;
    }
  }

  // Collect hooks
  const hookNodes = nodes.filter(n => n.type === 'hook');
  if (hookNodes.length > 0) {
    const hooksConfig: Record<string, Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>> = {};

    for (const hookNode of hookNodes) {
      const d = hookNode.data as unknown as HookData;
      const event = d.event || 'PreToolUse';
      if (!hooksConfig[event]) hooksConfig[event] = [];

      const connectedEdges = edges.filter(e => e.source === hookNode.id);
      const targetNodes = connectedEdges.map(e => nodes.find(n => n.id === e.target)).filter(Boolean);

      let action = d.action || '';
      if (!action && targetNodes.length > 0) {
        const target = targetNodes[0]!;
        if (target.type === 'rule') {
          const rd = target.data as unknown as RuleData;
          action = `cat "\${CLAUDE_PLUGIN_ROOT}/rules/${rd.name}.md"`;
        } else if (target.type === 'skill') {
          const sd = target.data as unknown as SkillData;
          action = `cat "\${CLAUDE_PLUGIN_ROOT}/skills/${sd.name}/SKILL.md"`;
        }
      }

      hooksConfig[event].push({
        matcher: d.matcher || '.*',
        hooks: [{ type: 'command', command: action }],
      });
    }

    const hooksJson = JSON.stringify(hooksConfig, null, 2);
    files.push({ path: 'hooks/hooks.json', content: hooksJson });
  }

  // Collect MCP configs
  const mcpNodes = nodes.filter(n => n.type === 'mcp');
  if (mcpNodes.length > 0) {
    const mcpConfig: Record<string, { command: string; args: string[]; env?: Record<string, string> }> = {};

    for (const mcpNode of mcpNodes) {
      const d = mcpNode.data as unknown as McpData;
      if (!d.serverName) { errors.push(`MCP node "${d.label}" has no server name`); continue; }
      mcpConfig[d.serverName] = {
        command: d.command || 'node',
        args: d.args || [],
        ...(Object.keys(d.env || {}).length > 0 ? { env: d.env } : {}),
      };
    }

    files.push({ path: '.mcp.json', content: JSON.stringify({ mcpServers: mcpConfig }, null, 2) });
  }

  return { files, errors, tokenEstimate: totalTokens };
}
