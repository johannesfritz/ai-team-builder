"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchPlugins, fetchPlugin, type PluginSummary, type PluginDetail } from '@/lib/api';
import { parsePluginFiles } from '@/lib/import/parse-plugin';
import { useBuilderStore } from '@/stores/builder-store';
import { useRouter } from 'next/navigation';

export default function ShowcasePage() {
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const [selected, setSelected] = useState<PluginDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const { loadGraph, setMeta } = useBuilderStore();
  const router = useRouter();

  useEffect(() => {
    fetchPlugins()
      .then(setPlugins)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleViewDetail = async (name: string) => {
    setLoadingDetail(true);
    try {
      const detail = await fetchPlugin(name);
      setSelected(detail);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenInBuilder = () => {
    if (!selected) return;
    const result = parsePluginFiles(selected.files);
    loadGraph(result.nodes, result.edges);
    setMeta({ name: selected.title, description: selected.description });
    router.push('/builder');
  };

  // Group files by type
  const filesByType = selected?.files.reduce((acc, f) => {
    const type = f.path.split('/')[0];
    if (!acc[type]) acc[type] = [];
    acc[type].push(f);
    return acc;
  }, {} as Record<string, typeof selected.files>) ?? {};

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      {/* Header */}
      <div className="border-b border-zinc-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-bold">
            AI Team<span className="text-emerald-400"> Builder</span>
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-sm text-zinc-400">Showcase</span>
        </div>
        <Link href="/builder">
          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300">
            Open Builder
          </Button>
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        <h1 className="text-3xl font-bold mb-2">Real-World Plugins</h1>
        <p className="text-zinc-400 mb-8">Production Claude Code plugins you can explore and open in the builder.</p>

        {loading && <div className="text-zinc-500">Loading plugins...</div>}

        {/* Plugin list */}
        {!selected && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plugins.map(plugin => (
              <Card
                key={plugin.name}
                className="bg-zinc-900 border-zinc-800 hover:border-emerald-600 transition-colors p-5 cursor-pointer"
                onClick={() => handleViewDetail(plugin.name)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                    {plugin.category}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                    v{plugin.version}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                    {plugin.file_count} files
                  </Badge>
                </div>
                <h3 className="text-lg font-semibold text-zinc-200 mb-1">{plugin.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{plugin.description}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Plugin detail */}
        {selected && (
          <div>
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-zinc-500 hover:text-zinc-300 mb-4 flex items-center gap-1"
            >
              &larr; Back to list
            </button>

            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">{selected.title}</h2>
                <p className="text-zinc-400 mt-1">{selected.description}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="border-zinc-700 text-zinc-400">{selected.category}</Badge>
                  <Badge variant="outline" className="border-zinc-700 text-zinc-500">v{selected.version}</Badge>
                  <Badge variant="outline" className="border-zinc-700 text-zinc-500">{selected.file_count} files</Badge>
                </div>
              </div>
              <Button
                onClick={handleOpenInBuilder}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Open in Builder
              </Button>
            </div>

            {/* File browser */}
            <div className="space-y-4">
              {Object.entries(filesByType).map(([type, files]) => (
                <div key={type}>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-2 capitalize">
                    {type} <span className="text-zinc-600 font-normal">({files.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {files.map(file => (
                      <details key={file.path} className="group">
                        <summary className="cursor-pointer text-xs font-mono text-zinc-400 hover:text-zinc-200 py-1 px-3 bg-zinc-900 rounded border border-zinc-800 group-open:border-emerald-800">
                          {file.path}
                        </summary>
                        <pre className="mt-1 p-3 bg-zinc-950 border border-zinc-800 rounded text-[11px] font-mono text-zinc-400 overflow-x-auto max-h-[300px] whitespace-pre-wrap">
                          {file.content}
                        </pre>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
