"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BuilderCanvas } from '@/components/builder/Canvas';
import { PropertyPanel } from '@/components/builder/PropertyPanel';
import { DryRunPanel } from '@/components/builder/DryRun';
import { Toolbar } from '@/components/builder/Toolbar';
import { useBuilderStore } from '@/stores/builder-store';
import { TEMPLATES } from '@/lib/templates';

function BuilderWithParams() {
  const [rightPanel, setRightPanel] = useState<'properties' | 'dryrun'>('properties');
  const searchParams = useSearchParams();
  const { loadGraph, setMeta } = useBuilderStore();
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

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200">
      <Toolbar onShowDryRun={() => setRightPanel('dryrun')} />
      <div className="flex-1 relative">
        <BuilderCanvas />
      </div>
      <div className="w-[320px] border-l border-zinc-800 bg-zinc-950 flex flex-col">
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
