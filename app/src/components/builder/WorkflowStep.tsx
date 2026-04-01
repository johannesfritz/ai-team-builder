"use client";

import { Badge } from '@/components/ui/badge';
import { NODE_COLORS, NODE_LABELS, type PluginNodeType } from '@/lib/plugin-types';
import type { WorkflowStep as WorkflowStepType } from '@/lib/workflow/derive';

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  setup: { label: 'Setup', color: 'text-blue-400' },
  trigger: { label: 'Trigger', color: 'text-orange-400' },
  execute: { label: 'Execute', color: 'text-green-400' },
  entry: { label: 'Entry Point', color: 'text-purple-400' },
};

interface WorkflowStepProps {
  step: WorkflowStepType;
  index: number;
  isLast: boolean;
  isSelected: boolean;
  onClick: () => void;
  dragHandleProps?: Record<string, unknown>;
}

export function WorkflowStepCard({ step, index, isLast, isSelected, onClick, dragHandleProps }: WorkflowStepProps) {
  const phaseInfo = PHASE_LABELS[step.phase] || PHASE_LABELS.setup;

  return (
    <div className="relative">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-5 top-[56px] w-px h-6 bg-zinc-700" />
      )}

      <div
        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
          isSelected
            ? 'bg-zinc-800 border-zinc-600'
            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
        }`}
        onClick={onClick}
      >
        {/* Drag handle + step number */}
        <div className="flex flex-col items-center shrink-0 pt-0.5" {...dragHandleProps}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2"
            style={{ borderColor: NODE_COLORS[step.nodeType], color: NODE_COLORS[step.nodeType] }}
          >
            {index + 1}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              className="text-[9px] h-4 px-1.5"
              style={{ background: NODE_COLORS[step.nodeType], color: '#fff' }}
            >
              {NODE_LABELS[step.nodeType]}
            </Badge>
            <span className="text-xs font-semibold text-zinc-200 truncate">{step.name}</span>
          </div>
          <div className="text-[11px] text-zinc-500 leading-relaxed">{step.description}</div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className={`text-[10px] font-medium ${phaseInfo.color}`}>{phaseInfo.label}</span>
            {step.tokenEstimate > 0 && (
              <span className="text-[10px] text-zinc-600">~{step.tokenEstimate} tokens</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
