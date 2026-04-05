"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useBuilderStore } from '@/stores/builder-store';
import { serializeGraph } from '@/lib/export/serialize';
import { generateMcpbBundle, downloadBlob } from '@/lib/export/mcpb';
import { encodeShareURL } from '@/lib/share';
import { toast } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { NODE_COLORS, NODE_LABELS, type PluginNodeType } from '@/lib/plugin-types';
import { ImportDialog } from './ImportDialog';
import { CreateNodeDialog } from './CreateNodeDialog';
import { HealthIndicator } from './HealthIndicator';

const NODE_TYPES: PluginNodeType[] = ['rule', 'hook', 'skill', 'command', 'agent', 'mcp'];

export function Toolbar({ onShowDryRun }: { onShowDryRun?: () => void }) {
  const { nodes, edges, addNode, meta, undo, redo, historyIndex, history } = useBuilderStore();
  const [showExport, setShowExport] = useState(false);
  const [exportOutput, setExportOutput] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogType, setCreateDialogType] = useState<PluginNodeType | undefined>(undefined);

  const handleExport = () => {
    if (nodes.length === 0) {
      toast('Add at least one component before exporting', 'warning');
      return;
    }
    const result = serializeGraph(nodes, edges, meta.name || 'my-plugin', '1.0.0', meta.description);

    if (result.errors.length > 0) {
      toast(`${result.errors.length} node(s) skipped due to missing fields`, 'warning');
    }

    let output = '';
    if (result.errors.length > 0) {
      output += `ERRORS:\n${result.errors.map(e => e.message).join('\n')}\n\n`;
    }
    output += `FILES (${result.files.length}):\n`;
    for (const file of result.files) {
      output += `\n--- ${file.path} ---\n${file.content}\n`;
    }
    output += `\nToken estimate: ~${result.tokenEstimate} tokens\n`;

    setExportOutput(output);
    setShowExport(true);
    trackEvent('Export Plugin', { nodeCount: String(nodes.length), errorCount: String(result.errors.length) });
  };

  const handleShare = () => {
    if (nodes.length === 0) {
      toast('Add at least one component before sharing', 'warning');
      return;
    }
    const state = {
      nodes,
      edges,
      meta: { name: meta.name, description: meta.description },
    };
    const baseUrl = typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://example.com/builder';
    const result = encodeShareURL(state, baseUrl);
    if ('error' in result) {
      toast(result.error, 'error');
      return;
    }
    navigator.clipboard.writeText(result.url).then(() => {
      toast('Share URL copied to clipboard', 'success');
    }).catch(() => {
      toast('Could not copy to clipboard', 'error');
    });
    trackEvent('Share URL', { nodeCount: String(nodes.length) });
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
            onClick={() => { setCreateDialogType(type); setCreateDialogOpen(true); }}
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

        <ImportDialog />

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
          variant="outline"
          className="border-violet-600 text-violet-400 hover:bg-violet-950 font-semibold h-8"
          onClick={handleShare}
        >
          Share URL
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
          <HealthIndicator />
          <div className="text-[9px] text-zinc-700 leading-tight">
            Valid: hook→rule/skill, agent→skill, skill→command
          </div>
        </div>
      </div>

      {/* Export modal */}
      {showExport && (() => {
        const result = serializeGraph(nodes, edges, meta.name || 'my-plugin', '1.0.0', meta.description);
        const pluginSlug = (meta.name || 'my-plugin').toLowerCase().replace(/\s+/g, '-');
        return (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-200">Export Plugin</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowExport(false)} className="text-zinc-500 h-7 w-7 p-0">x</Button>
              </div>

              <div className="overflow-y-auto flex-1 p-4 space-y-4">
                {result.errors.length > 0 && (
                  <div className="p-3 bg-red-950 border border-red-800 rounded-lg">
                    <div className="text-xs font-semibold text-red-400 mb-1">Errors ({result.errors.length})</div>
                    {result.errors.map((e, i) => <div key={i} className="text-[11px] text-red-300">{e.message}</div>)}
                  </div>
                )}

                <div className="text-xs text-zinc-400">
                  {result.files.length} files · ~{result.tokenEstimate} tokens
                </div>

                {/* File tree */}
                <div className="space-y-1">
                  {result.files.map(file => (
                    <details key={file.path} className="group">
                      <summary className="cursor-pointer text-xs font-mono text-zinc-400 hover:text-zinc-200 py-1.5 px-3 bg-zinc-950 rounded border border-zinc-800 group-open:border-emerald-800 group-open:bg-zinc-900">
                        .claude-plugin/{file.path}
                      </summary>
                      <pre className="mt-1 p-3 bg-zinc-950 border border-zinc-800 rounded text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-[200px] whitespace-pre-wrap leading-relaxed">
                        {file.content}
                      </pre>
                    </details>
                  ))}
                </div>

                {/* Install instructions */}
                <div className="p-3 bg-zinc-800 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-zinc-300">How to install</div>
                  <div className="text-[11px] text-zinc-400 space-y-1.5">
                    <div>1. Download the JSON file below</div>
                    <div>2. In your project, create the <code className="bg-zinc-700 px-1 rounded">.claude-plugin/</code> directory</div>
                    <div>3. Extract the files from the JSON into that directory</div>
                    <div>4. Or, if published to GitHub:</div>
                    <div className="pl-4">
                      <code className="bg-zinc-700 px-2 py-1 rounded text-emerald-300 text-[10px]">
                        claude plugin add your-username/{pluginSlug}
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-zinc-800 space-y-2">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify({ files: result.files }, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${pluginSlug}-plugin.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download JSON
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-purple-600 text-purple-400 hover:bg-purple-950 font-semibold"
                  onClick={async () => {
                    try {
                      const blob = await generateMcpbBundle(result.files, meta.name || pluginSlug, '1.0.0', meta.description);
                      downloadBlob(blob, `${pluginSlug}.mcpb`);
                      trackEvent('Export MCPB', { nodeCount: String(nodes.length) });
                    } catch {
                      toast('Failed to generate MCPB bundle', 'error');
                    }
                  }}
                >
                  Download MCPB Bundle
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      <CreateNodeDialog
        open={createDialogOpen}
        onClose={() => { setCreateDialogOpen(false); setCreateDialogType(undefined); }}
        presetType={createDialogType}
      />
    </>
  );
}
