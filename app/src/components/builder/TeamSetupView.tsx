"use client";

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useBuilderStore } from '@/stores/builder-store';
import { NODE_COLORS, NODE_LABELS, type PluginNodeType } from '@/lib/plugin-types';
import { getNodeHealth, type NodeHealth } from '@/lib/validation';
import type { RuleData, HookData, SkillData, CommandData, AgentData, McpData } from '@/lib/plugin-types';
import type { Node } from '@xyflow/react';

const SECTION_ORDER: PluginNodeType[] = ['agent', 'skill', 'command', 'rule', 'hook', 'mcp'];

const HEALTH_ICONS: Record<NodeHealth, { icon: string; color: string }> = {
  valid: { icon: '●', color: 'text-emerald-500' },
  warning: { icon: '▲', color: 'text-amber-400' },
  error: { icon: '○', color: 'text-red-400' },
};

function getNodeSubtitle(node: Node): string {
  const type = node.type as PluginNodeType;
  const d = node.data as Record<string, unknown>;

  switch (type) {
    case 'agent': {
      const ad = d as unknown as AgentData;
      const tools = ad.allowedTools?.length ? `${ad.allowedTools.length} tools` : 'all tools';
      return `Model: ${ad.model || 'inherit'} · ${tools}`;
    }
    case 'skill': {
      const sd = d as unknown as SkillData;
      return sd.description || (sd.filePattern ? `Files: ${sd.filePattern}` : 'No description');
    }
    case 'command': {
      const cd = d as unknown as CommandData;
      return cd.description || 'No description';
    }
    case 'rule': {
      const rd = d as unknown as RuleData;
      return rd.pathFilter ? `Path: ${rd.pathFilter}` : 'Global (always loads)';
    }
    case 'hook': {
      const hd = d as unknown as HookData;
      return `${hd.event}: ${hd.matcher || '*'}${hd.once ? ' (once)' : ''}`;
    }
    case 'mcp': {
      const md = d as unknown as McpData;
      return `${md.command || '?'} ${(md.args || []).join(' ')}`;
    }
    default:
      return '';
  }
}

function getNodeName(node: Node): string {
  const type = node.type as PluginNodeType;
  const d = node.data as Record<string, unknown>;

  switch (type) {
    case 'command': return `/${(d as unknown as CommandData).name || 'untitled'}`;
    default: return (d as { name?: string; label?: string }).name || (d as { label?: string }).label || 'Untitled';
  }
}

export function TeamSetupView() {
  const { nodes, selectedNodeId, setSelectedNodeId, addNode, meta } = useBuilderStore();

  const grouped = useMemo(() => {
    const groups: Record<PluginNodeType, Node[]> = {
      rule: [], hook: [], skill: [], command: [], agent: [], mcp: [],
    };
    for (const node of nodes) {
      const type = node.type as PluginNodeType;
      if (groups[type]) groups[type].push(node);
    }
    return groups;
  }, [nodes]);

  const totalNodes = nodes.length;

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-6">
      {/* Team Overview */}
      <Card className="bg-zinc-900 border-zinc-800 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-200">
              {meta.name || 'Untitled Plugin'}
            </h2>
            {meta.description && (
              <p className="text-sm text-zinc-500 mt-1 max-w-xl">{meta.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-zinc-200">{totalNodes}</div>
            <div className="text-xs text-zinc-500">components</div>
          </div>
        </div>
        <div className="flex gap-3 mt-3 flex-wrap">
          {SECTION_ORDER.map(type => {
            const count = grouped[type].length;
            if (count === 0) return null;
            return (
              <Badge
                key={type}
                variant="outline"
                className="text-xs border-zinc-700"
                style={{ color: NODE_COLORS[type] }}
              >
                {count} {NODE_LABELS[type]}{count !== 1 ? 's' : ''}
              </Badge>
            );
          })}
        </div>
      </Card>

      {/* Sections by type */}
      {SECTION_ORDER.map(type => {
        const items = grouped[type];
        return (
          <div key={type} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: NODE_COLORS[type] }}
                />
                <h3 className="text-sm font-semibold text-zinc-300">
                  {NODE_LABELS[type]}s
                </h3>
                <span className="text-xs text-zinc-600">({items.length})</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                style={{ color: NODE_COLORS[type] }}
                onClick={() => addNode(type)}
              >
                + Add
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="text-xs text-zinc-700 italic pl-4">
                No {NODE_LABELS[type].toLowerCase()}s yet
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map(node => {
                  const health = getNodeHealth(type, node.data as Record<string, unknown>);
                  const healthInfo = HEALTH_ICONS[health];
                  const isSelected = node.id === selectedNodeId;

                  return (
                    <Card
                      key={node.id}
                      className={`p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-zinc-800 border-zinc-600'
                          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      }`}
                      onClick={() => setSelectedNodeId(node.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[10px] ${healthInfo.color}`}>{healthInfo.icon}</span>
                          <span className="text-xs font-semibold text-zinc-200 truncate">
                            {getNodeName(node)}
                          </span>
                        </div>
                        <Badge
                          className="text-[8px] h-4 px-1 shrink-0"
                          style={{ background: NODE_COLORS[type], color: '#fff' }}
                        >
                          {NODE_LABELS[type]}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1 truncate">
                        {getNodeSubtitle(node)}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {totalNodes === 0 && (
        <div className="text-center py-16 text-zinc-600">
          <div className="text-lg mb-2">No components yet</div>
          <div className="text-sm">Add agents, skills, commands, and rules using the toolbar.</div>
        </div>
      )}
    </div>
  );
}
