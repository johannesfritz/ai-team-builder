"use client";

import { type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { type PluginNodeType, NODE_COLORS } from '@/lib/plugin-types';

interface BaseNodeProps {
  type: PluginNodeType;
  typeLabel: string;
  title: string;
  selected?: boolean;
  hasSource?: boolean;
  hasTarget?: boolean;
  children?: ReactNode;
}

export function BaseNode({ type, typeLabel, title, selected, hasSource = false, hasTarget = true, children }: BaseNodeProps) {
  const color = NODE_COLORS[type];

  return (
    <div
      className="rounded-lg border-2 bg-zinc-900 min-w-[220px] max-w-[300px] font-sans text-sm text-zinc-200"
      style={{ borderColor: selected ? '#fff' : color }}
    >
      {hasTarget && (
        <Handle type="target" position={Position.Left} className="!w-3 !h-3" style={{ background: color }} />
      )}
      {hasSource && (
        <Handle type="source" position={Position.Right} className="!w-3 !h-3" style={{ background: color }} />
      )}

      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
          style={{ background: color }}
        >
          {typeLabel}
        </span>
        <span className="font-semibold text-xs truncate">{title || `Untitled ${typeLabel}`}</span>
      </div>

      <div className="px-3 pb-2.5 space-y-1">
        {children}
      </div>
    </div>
  );
}

export function NodeField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="text-[11px] text-zinc-400">
      {label}: <code className="bg-zinc-800 px-1 rounded text-zinc-300">{value}</code>
    </div>
  );
}

export function NodePreview({ text, maxLength = 100 }: { text: string; maxLength?: number }) {
  if (!text) return <div className="text-[11px] text-zinc-500 italic">No content</div>;
  const truncated = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  return <div className="text-[11px] text-zinc-400 leading-relaxed">{truncated}</div>;
}
