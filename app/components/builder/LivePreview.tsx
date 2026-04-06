"use client";

import { useMemo } from 'react';
import { useBuilderStore } from '@/stores/builder-store';
import { serializeGraph } from '@/lib/export/serialize';
import { Badge } from '@/components/ui/badge';

export function LivePreview() {
  const { nodes, edges, meta } = useBuilderStore();

  const result = useMemo(
    () => serializeGraph(nodes, edges, meta.name || 'my-plugin', '1.0.0', meta.description),
    [nodes, edges, meta.name, meta.description]
  );

  if (nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-600 text-sm p-4">
        Add components to see the generated plugin files
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{result.files.length} files · ~{result.tokenEstimate} tokens</span>
        {result.errors.length > 0 && (
          <Badge variant="outline" className="text-amber-400 border-amber-600 text-[10px]">
            {result.errors.length} skipped
          </Badge>
        )}
      </div>

      {result.errors.length > 0 && (
        <div className="p-2 bg-amber-950/50 border border-amber-800/50 rounded text-[10px] text-amber-300 space-y-0.5">
          {result.errors.map((e, i) => <div key={i}>{e.message}</div>)}
        </div>
      )}

      {result.files.map(file => (
        <div key={file.path} className="border border-zinc-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
            <span className="text-[11px] font-mono text-zinc-400">{file.path}</span>
            <button
              type="button"
              className="text-[10px] text-zinc-600 hover:text-emerald-400 transition-colors"
              onClick={() => navigator.clipboard.writeText(file.content)}
            >
              Copy
            </button>
          </div>
          <pre className="p-3 text-[11px] font-mono text-emerald-300/80 overflow-x-auto max-h-[200px] leading-relaxed whitespace-pre-wrap bg-zinc-950">
            {file.content}
          </pre>
        </div>
      ))}
    </div>
  );
}
