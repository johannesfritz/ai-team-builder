"use client";

import { useState } from 'react';

interface HelpTooltipProps {
  text: string;
  example?: string;
}

export function HelpTooltip({ text, example }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block ml-1">
      <button
        type="button"
        className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 text-[10px] font-bold inline-flex items-center justify-center transition-colors"
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        aria-label="Help"
      >
        ?
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-6 w-64 p-3 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl text-xs text-zinc-300 leading-relaxed">
          <div>{text}</div>
          {example && (
            <div className="mt-2 p-1.5 bg-zinc-900 rounded font-mono text-[10px] text-emerald-300">
              {example}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
