"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FullscreenEditorProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  title: string;
  typeBadge?: string;
  typeColor?: string;
  placeholder?: string;
  help?: string;
  /** When set on open, scroll the textarea to the line containing
   * `## <scrollToHeading>` and select that heading line. */
  scrollToHeading?: string | null;
}

export function FullscreenEditor({
  open, onClose, value, onChange, title, typeBadge, typeColor, placeholder, help, scrollToHeading,
}: FullscreenEditorProps) {
  const [localValue, setLocalValue] = useState(value);
  const [wordCount, setWordCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [tokenEstimate, setTokenEstimate] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value, open]);

  // After the editor mounts (or scrollToHeading changes while open), scroll
  // the textarea so the requested `## heading` line is visible and selected.
  useEffect(() => {
    if (!open || !scrollToHeading) return;
    const ta = textareaRef.current;
    if (!ta) return;
    // Defer one frame so the textarea has its final size before we measure.
    const id = requestAnimationFrame(() => {
      const text = ta.value;
      // Match the heading at start of line, tolerant to trailing whitespace.
      const escaped = scrollToHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`^##\\s+${escaped}\\s*$`, 'm');
      const m = text.match(re);
      if (!m || m.index === undefined) return;
      const start = m.index;
      const end = start + m[0].length;
      ta.focus();
      ta.setSelectionRange(start, end);
      // Compute scrollTop manually — setSelectionRange doesn't always scroll
      // a fresh-mounted textarea reliably across browsers.
      const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 20;
      const linesBefore = text.slice(0, start).split('\n').length - 1;
      ta.scrollTop = Math.max(0, linesBefore * lineHeight - ta.clientHeight / 4);
    });
    return () => cancelAnimationFrame(id);
  }, [open, scrollToHeading, localValue]);

  useEffect(() => {
    const text = localValue || '';
    setCharCount(text.length);
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    setLineCount(text.split('\n').length);
    setTokenEstimate(Math.ceil(text.length / 4));
  }, [localValue]);

  const handleSave = useCallback(() => {
    onChange(localValue);
    onClose();
  }, [localValue, onChange, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleSave();
    }
    // Cmd/Ctrl+Enter to save and close
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  }, [handleSave]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          {typeBadge && (
            <Badge style={{ background: typeColor }} className="text-white text-[10px]">
              {typeBadge}
            </Badge>
          )}
          <span className="text-sm font-semibold text-zinc-200">{title}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-[10px] text-zinc-500">
            <span>{wordCount} words</span>
            <span>{lineCount} lines</span>
            <span>{charCount} chars</span>
            <span>~{tokenEstimate} tokens</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-xs text-zinc-400 h-7" onClick={handleSave}>
              Esc
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7" onClick={handleSave}>
              Done
            </Button>
          </div>
        </div>
      </div>

      {/* Help text */}
      {help && (
        <div className="px-6 py-2 border-b border-zinc-800/50 shrink-0">
          <div className="text-[11px] text-zinc-500">{help}</div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden p-6">
        <textarea
          ref={textareaRef}
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-full bg-zinc-900 border border-zinc-800 rounded-lg p-5 font-mono text-sm text-zinc-200 leading-relaxed resize-none outline-none focus:border-emerald-700 placeholder:text-zinc-700"
          autoFocus
        />
      </div>
    </div>
  );
}
