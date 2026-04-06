"use client";

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { SkillData } from '@/lib/plugin-types';
import { BaseNode, NodeField } from './BaseNode';

export const SkillNode = memo(function SkillNode({ data, selected }: NodeProps) {
  const d = data as unknown as SkillData;
  return (
    <BaseNode type="skill" typeLabel="Skill" title={d.name} selected={selected} hasSource hasTarget>
      {d.description && <div className="text-[11px] text-zinc-400">{d.description}</div>}
      <NodeField label="Files" value={d.filePattern} />
      <NodeField label="Bash" value={d.bashPattern} />
    </BaseNode>
  );
});
