"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { TeamSetupView } from '@/components/builder/TeamSetupView';
import { WorkflowView } from '@/components/builder/WorkflowView';
import { BuilderCanvas } from '@/components/builder/Canvas';
import { PropertyPanel } from '@/components/builder/PropertyPanel';
import { DryRunPanel } from '@/components/builder/DryRun';
import { LivePreview } from '@/components/builder/LivePreview';
import { Toolbar } from '@/components/builder/Toolbar';
import { CommandPalette } from '@/components/builder/CommandPalette';
import { useBuilderStore } from '@/stores/builder-store';
import { TEMPLATES } from '@/lib/templates';
import { serializeGraph } from '@/lib/export/serialize';
import { encodeShareURL, decodeShareURL } from '@/lib/share';
import { getGitHubToken, setGitHubToken } from '@/lib/github-auth';
import { toast } from '@/lib/toast';

type MainView = 'setup' | 'workflow' | 'canvas';
type RightPanel = 'properties' | 'dryrun' | 'preview';

function BuilderWithParams() {
  const [mainView, setMainView] = useState<MainView>('setup');
  const [rightPanel, setRightPanel] = useState<RightPanel>('properties');
  const searchParams = useSearchParams();
  const { nodes, edges, meta, loadGraph, setMeta, undo, redo } = useBuilderStore();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;

    const hash = typeof window !== 'undefined' ? window.location.hash : '';

    // Handle GitHub OAuth callback: #github_token=...
    if (hash.startsWith('#github_token=')) {
      const token = hash.slice('#github_token='.length);
      if (token) {
        setGitHubToken(token);
        toast('GitHub connected', 'success');
      }
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setLoaded(true);
      return;
    }

    // Check for share URL hash (v1:... or gist:...)
    if (hash.startsWith('#v1:') || hash.startsWith('#gist:')) {
      decodeShareURL(hash).then(result => {
        if ('nodes' in result) {
          loadGraph(result.nodes as Parameters<typeof loadGraph>[0], result.edges as Parameters<typeof loadGraph>[1]);
          setMeta({ name: result.meta.name, description: result.meta.description });
          toast('Shared plugin loaded successfully', 'success');
        } else {
          toast(result.error, 'error');
        }
        // Clear the hash to avoid re-loading on navigation
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      });
      setLoaded(true);
      return;
    }

    const templateId = searchParams.get('template');
    if (templateId) {
      const template = TEMPLATES.find(t => t.id === templateId);
      if (template) {
        loadGraph(template.nodes, template.edges);
        setMeta({ name: template.name, description: template.description });
      }
    }
    setLoaded(true);
  }, [searchParams, loadGraph, setMeta, loaded]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === '1' && !e.metaKey && !e.ctrlKey) setMainView('setup');
      if (e.key === '2' && !e.metaKey && !e.ctrlKey) setMainView('workflow');
      if (e.key === '3' && !e.metaKey && !e.ctrlKey) setMainView('canvas');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const handleCmdExport = () => {
    if (nodes.length === 0) { toast('Add at least one component before exporting', 'warning'); return; }
    const result = serializeGraph(nodes, edges, meta.name || 'my-plugin', '1.0.0', meta.description);
    const pluginSlug = (meta.name || 'my-plugin').toLowerCase().replace(/\s+/g, '-');
    const blob = new Blob([JSON.stringify({ files: result.files }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pluginSlug}-plugin.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Plugin exported', 'success');
  };

  const handleCmdImport = () => {
    // Trigger a file input click for importing
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.nodes && data.edges) {
          loadGraph(data.nodes, data.edges);
          if (data.meta) setMeta(data.meta);
          toast('Plugin imported', 'success');
        }
      } catch {
        toast('Failed to import file', 'error');
      }
    };
    input.click();
  };

  const handleCmdShare = async () => {
    if (nodes.length === 0) { toast('Add at least one component before sharing', 'warning'); return; }
    const state = { nodes, edges, meta: { name: meta.name, description: meta.description } };
    const baseUrl = typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://example.com/builder';
    const token = getGitHubToken() ?? undefined;
    const result = await encodeShareURL(state, baseUrl, token);
    if ('error' in result) { toast(result.error, 'error'); return; }
    navigator.clipboard.writeText(result.url).then(() => {
      toast('Share URL copied to clipboard', 'success');
    }).catch(() => {
      toast('Could not copy to clipboard', 'error');
    });
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200">
      <Toolbar onShowDryRun={() => setRightPanel('dryrun')} />
      <CommandPalette onExport={handleCmdExport} onImport={handleCmdImport} onShare={handleCmdShare} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* View toggle */}
        <div className="flex border-b border-zinc-800 shrink-0">
          <button
            className={`px-4 py-2.5 text-xs font-medium transition-colors ${
              mainView === 'setup'
                ? 'text-zinc-200 border-b-2 border-emerald-500 bg-zinc-900/50'
                : 'text-zinc-500 hover:text-zinc-400'
            }`}
            onClick={() => setMainView('setup')}
          >
            Team Setup
          </button>
          <button
            className={`px-4 py-2.5 text-xs font-medium transition-colors ${
              mainView === 'workflow'
                ? 'text-zinc-200 border-b-2 border-emerald-500 bg-zinc-900/50'
                : 'text-zinc-500 hover:text-zinc-400'
            }`}
            onClick={() => setMainView('workflow')}
          >
            Workflow
          </button>
          <button
            className={`px-4 py-2.5 text-xs font-medium transition-colors ${
              mainView === 'canvas'
                ? 'text-zinc-200 border-b-2 border-emerald-500 bg-zinc-900/50'
                : 'text-zinc-500 hover:text-zinc-400'
            }`}
            onClick={() => setMainView('canvas')}
          >
            Canvas
          </button>
        </div>

        {/* View content */}
        <div className="flex-1 relative overflow-hidden">
          {mainView === 'setup' && <TeamSetupView />}
          {mainView === 'workflow' && <WorkflowView />}
          {mainView === 'canvas' && <BuilderCanvas />}
        </div>
      </div>

      {/* Right panel */}
      <div className="w-[320px] border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
        <div className="flex border-b border-zinc-800">
          <button
            className={`flex-1 px-3 py-2 text-xs font-medium ${rightPanel === 'properties' ? 'text-zinc-200 border-b-2 border-emerald-500' : 'text-zinc-500'}`}
            onClick={() => setRightPanel('properties')}
          >
            Properties
          </button>
          <button
            className={`flex-1 px-3 py-2 text-xs font-medium ${rightPanel === 'dryrun' ? 'text-zinc-200 border-b-2 border-emerald-500' : 'text-zinc-500'}`}
            onClick={() => setRightPanel('dryrun')}
          >
            Dry Run
          </button>
          <button
            className={`flex-1 px-3 py-2 text-xs font-medium ${rightPanel === 'preview' ? 'text-zinc-200 border-b-2 border-emerald-500' : 'text-zinc-500'}`}
            onClick={() => setRightPanel('preview')}
          >
            Preview
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {rightPanel === 'properties' && <PropertyPanel />}
          {rightPanel === 'dryrun' && <DryRunPanel />}
          {rightPanel === 'preview' && <LivePreview />}
        </div>
      </div>
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<div className="flex h-screen bg-zinc-950 items-center justify-center text-zinc-500">Loading...</div>}>
      <BuilderWithParams />
    </Suspense>
  );
}
