"use client";

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { AgentData } from '@/lib/plugin-types';
import { BaseNode, NodeField } from './BaseNode';

export const AgentNode = memo(function AgentNode({ data, selected }: NodeProps) {
  const d = data as unknown as AgentData;
  return (
    <BaseNode type="agent" typeLabel="Agent" title={d.name} selected={selected} hasSource hasTarget>
      <NodeField label="Model" value={d.model} />
      {d.allowedTools?.length > 0 && (
        <div className="text-[11px] text-zinc-400">Tools: {d.allowedTools.join(', ')}</div>
      )}
    </BaseNode>
  );
});
