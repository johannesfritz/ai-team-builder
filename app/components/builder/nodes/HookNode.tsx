"use client";

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { HookData } from '@/lib/plugin-types';
import { BaseNode, NodeField } from './BaseNode';

export const HookNode = memo(function HookNode({ data, selected }: NodeProps) {
  const d = data as unknown as HookData;
  return (
    <BaseNode type="hook" typeLabel="Hook" title={d.event || 'PreToolUse'} selected={selected} hasSource hasTarget>
      <NodeField label="Matcher" value={d.matcher} />
      <NodeField label="Action" value={d.action} />
      {d.once && <div className="text-[10px] text-orange-400 font-medium">once per session</div>}
    </BaseNode>
  );
});
