"use client";

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { McpData } from '@/lib/plugin-types';
import { BaseNode, NodeField } from './BaseNode';

export const McpNode = memo(function McpNode({ data, selected }: NodeProps) {
  const d = data as unknown as McpData;
  return (
    <BaseNode type="mcp" typeLabel="MCP" title={d.serverName} selected={selected}>
      <NodeField label="Command" value={d.command} />
      {d.args?.length > 0 && (
        <div className="text-[11px] text-zinc-400">Args: {d.args.join(' ')}</div>
      )}
    </BaseNode>
  );
});
