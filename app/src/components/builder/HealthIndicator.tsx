"use client";

import { useMemo, useState } from 'react';
import { useBuilderStore } from '@/stores/builder-store';
import { analyzeHealth } from '@/lib/health';

export function HealthIndicator() {
  const { nodes, edges } = useBuilderStore();
  const [expanded, setExpanded] = useState(false);

  const report = useMemo(() => analyzeHealth(nodes, edges), [nodes, edges]);

  if (nodes.length === 0) return null;

  const color = report.score === 'healthy' ? 'bg-emerald-500'
    : report.score === 'warnings' ? 'bg-amber-500'
    : 'bg-red-500';

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-1.5 text-[10px] text-zinc-400 hover:text-zinc-300"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`w-2 h-2 rounded-full ${color}`} />
        {report.score === 'healthy' ? 'Healthy' : `${report.issues.length} issue${report.issues.length !== 1 ? 's' : ''}`}
      </button>

      {expanded && report.issues.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl z-50 space-y-1.5">
          <div className="text-[10px] font-semibold text-zinc-300 mb-2">Plugin Health</div>
          {report.issues.map((issue, i) => (
            <div key={i} className={`text-[10px] leading-relaxed ${
              issue.severity === 'error' ? 'text-red-400' : issue.severity === 'warning' ? 'text-amber-400' : 'text-zinc-500'
            }`}>
              {issue.severity === 'error' ? '\u25CF' : issue.severity === 'warning' ? '\u25B2' : '\u2139'} {issue.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
