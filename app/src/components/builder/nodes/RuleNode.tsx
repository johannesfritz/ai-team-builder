"use client";

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { RuleData } from '@/lib/plugin-types';
import { BaseNode, NodeField, NodePreview } from './BaseNode';

export const RuleNode = memo(function RuleNode({ data, selected }: NodeProps) {
  const d = data as unknown as RuleData;
  return (
    <BaseNode type="rule" typeLabel="Rule" title={d.name} selected={selected}>
      <NodeField label="Path" value={d.pathFilter} />
      <NodePreview text={d.content} />
    </BaseNode>
  );
});
