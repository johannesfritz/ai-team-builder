"use client";

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { CommandData } from '@/lib/plugin-types';
import { BaseNode, NodePreview } from './BaseNode';

export const CommandNode = memo(function CommandNode({ data, selected }: NodeProps) {
  const d = data as unknown as CommandData;
  return (
    <BaseNode type="command" typeLabel="Cmd" title={`/${d.name || 'untitled'}`} selected={selected}>
      {d.description && <div className="text-[11px] text-zinc-400">{d.description}</div>}
      <NodePreview text={d.prompt} maxLength={80} />
    </BaseNode>
  );
});
