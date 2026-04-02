"use client";

import { useState, useRef, useEffect } from 'react';

interface HelpTooltipProps {
  text: string;
  example?: string;
}

export function HelpTooltip({ text, example }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position below the button, aligned to the right edge but clamped to viewport
      const popoverWidth = 260;
      let left = rect.right - popoverWidth;
      if (left < 8) left = 8;
      if (left + popoverWidth > window.innerWidth - 8) left = window.innerWidth - popoverWidth - 8;

      setPosition({
        top: rect.bottom + 4,
        left,
      });
    }
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 text-[10px] font-bold inline-flex items-center justify-center transition-colors ml-1 shrink-0"
        onClick={() => setOpen(!open)}
        aria-label="Help"
      >
        ?
      </button>
      {open && (
        <>
          {/* Backdrop to close on click outside */}
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          {/* Popover */}
          <div
            className="fixed z-[61] w-[260px] p-3 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl text-xs text-zinc-300 leading-relaxed"
            style={{ top: position.top, left: position.left }}
          >
            <div>{text}</div>
            {example && (
              <div className="mt-2 p-1.5 bg-zinc-900 rounded font-mono text-[10px] text-emerald-300 break-all">
                {example}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
