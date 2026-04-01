"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useBuilderStore } from '@/stores/builder-store';
import { serializeGraph } from '@/lib/export/serialize';
import { NODE_COLORS, NODE_LABELS, type PluginNodeType } from '@/lib/plugin-types';

const NODE_TYPES: PluginNodeType[] = ['rule', 'hook', 'skill', 'command', 'agent', 'mcp'];

export function Toolbar({ onShowDryRun }: { onShowDryRun?: () => void }) {
  const { nodes, edges, addNode, meta, undo, redo, historyIndex, history } = useBuilderStore();
  const [showExport, setShowExport] = useState(false);
  const [exportOutput, setExportOutput] = useState('');

  const handleExport = () => {
    const result = serializeGraph(nodes, edges, meta.name || 'my-plugin', '1.0.0', meta.description);
    let output = '';

    if (result.errors.length > 0) {
      output += `ERRORS:\n${result.errors.join('\n')}\n\n`;
    }

    output += `FILES (${result.files.length}):\n`;
    for (const file of result.files) {
      output += `\n--- ${file.path} ---\n${file.content}\n`;
    }

    output += `\nToken estimate: ~${result.tokenEstimate} tokens\n`;

    setExportOutput(output);
    setShowExport(true);
  };

  return (
    <>
      <div className="w-[200px] border-r border-zinc-800 bg-zinc-950 flex flex-col p-3 gap-2 shrink-0">
        <h2 className="text-sm font-bold text-zinc-200 mb-1">AI Team Builder</h2>

        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Add Component</div>
        {NODE_TYPES.map(type => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            className="justify-start h-8 text-xs font-semibold border"
            style={{
              borderColor: NODE_COLORS[type],
              color: NODE_COLORS[type],
              background: NODE_COLORS[type] + '10',
            }}
            onClick={() => addNode(type)}
          >
            + {NODE_LABELS[type]}
          </Button>
        ))}

        <Separator className="bg-zinc-800 my-1" />

        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="flex-1 text-xs text-zinc-400 h-7" onClick={undo} disabled={historyIndex <= 0}>
            Undo
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 text-xs text-zinc-400 h-7" onClick={redo} disabled={historyIndex >= history.length - 1}>
            Redo
          </Button>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="border-cyan-600 text-cyan-400 hover:bg-cyan-950 font-semibold h-8"
          onClick={onShowDryRun}
        >
          Dry Run
        </Button>

        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-9"
          onClick={handleExport}
        >
          Export Plugin
        </Button>

        <div className="mt-auto space-y-1">
          <div className="text-[10px] text-zinc-600">
            <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
              {nodes.length} nodes
            </Badge>{' '}
            <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
              {edges.length} edges
            </Badge>
          </div>
          <div className="text-[9px] text-zinc-700 leading-tight">
            Valid: hook→rule/skill, agent→skill, skill→command
          </div>
        </div>
      </div>

      {/* Export modal */}
      {showExport && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-200">Export Preview</h3>
              <div className="flex gap-2">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7" onClick={() => {
                  const result = serializeGraph(nodes, edges, meta.name || 'my-plugin', '1.0.0', meta.description);
                  const blob = new Blob([JSON.stringify({ files: result.files }, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${meta.name || 'plugin'}-export.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  Download JSON
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowExport(false)} className="text-zinc-500 h-7 w-7 p-0">
                  x
                </Button>
              </div>
            </div>
            <pre className="p-4 overflow-auto flex-1 text-[11px] font-mono text-emerald-300 leading-relaxed whitespace-pre-wrap">
              {exportOutput}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
