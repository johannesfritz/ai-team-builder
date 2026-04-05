"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { TeamSetupView } from '@/components/builder/TeamSetupView';
import { WorkflowView } from '@/components/builder/WorkflowView';
import { BuilderCanvas } from '@/components/builder/Canvas';
import { PropertyPanel } from '@/components/builder/PropertyPanel';
import { DryRunPanel } from '@/components/builder/DryRun';
import { Toolbar } from '@/components/builder/Toolbar';
import { useBuilderStore } from '@/stores/builder-store';
import { TEMPLATES } from '@/lib/templates';

type MainView = 'setup' | 'workflow' | 'canvas';
type RightPanel = 'properties' | 'dryrun';

function BuilderWithParams() {
  const [mainView, setMainView] = useState<MainView>('setup');
  const [rightPanel, setRightPanel] = useState<RightPanel>('properties');
  const searchParams = useSearchParams();
  const { loadGraph, setMeta, undo, redo } = useBuilderStore();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
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

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200">
      <Toolbar onShowDryRun={() => setRightPanel('dryrun')} />

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
        </div>
        <div className="flex-1 overflow-hidden">
          {rightPanel === 'properties' ? <PropertyPanel /> : <DryRunPanel />}
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
