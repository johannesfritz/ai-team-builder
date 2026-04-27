"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchPlugins, fetchPlugin, type PluginSummary, type PluginDetail } from '@/lib/api';
import { parsePluginFiles } from '@/lib/import/parse-plugin';
import { TEMPLATES } from '@/lib/templates';
import { GITHUB_PLUGINS } from '@/lib/github-plugins';
import { useBuilderStore } from '@/stores/builder-store';
import { useRouter } from 'next/navigation';
import { assetPath } from '@/lib/base-path';

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

        {/* Templates */}
        {!selected && (
          <>
            {/* Live team plugins on GitHub — click to connect + edit + save back */}
            <div className="mb-2 flex items-baseline gap-3">
              <h2 className="text-xl font-bold">Live Team Plugins</h2>
              <span className="text-xs text-zinc-500">
                Connect, edit, save back to the source repo. Changes ship as commits.
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-12">
              {GITHUB_PLUGINS.map(p => (
                <Card
                  key={p.id}
                  className="bg-zinc-900 border-zinc-800 hover:border-sky-600 hover:shadow-lg hover:shadow-sky-900/20 transition-all duration-200 p-5 group"
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] border-sky-700 text-sky-400">
                      Live · GitHub
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                      {p.team}
                    </Badge>
                    {p.badge && (
                      <Badge variant="outline" className="text-[10px] border-amber-700 text-amber-400">
                        {p.badge}
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-200 mb-1 group-hover:text-sky-400 transition-colors">
                    {p.title}
                  </h3>
                  <p className="text-sm text-zinc-500 leading-relaxed mb-2">{p.description}</p>
                  <code className="block text-[11px] text-zinc-600 mb-3 font-mono">
                    {p.repo}{p.branch ? `@${p.branch}` : ''}
                  </code>
                  <div className="flex items-center gap-2">
                    <Link href={`/builder?connect=${encodeURIComponent(p.repo + (p.branch ? '@' + p.branch : ''))}`}>
                      <Button size="sm" variant="outline" className="border-sky-700 text-sky-400 hover:bg-sky-950 text-xs h-7">
                        Open &amp; Connect
                      </Button>
                    </Link>
                    <a
                      href={`https://github.com/${p.repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-zinc-500 hover:text-zinc-300"
                    >
                      View on GitHub →
                    </a>
                  </div>
                </Card>
              ))}
            </div>

            {/* OAuth org-access note */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-12 text-[11px] text-zinc-500 leading-relaxed">
              <strong className="text-zinc-300">Note for org admins:</strong> private repos in
              GitHub organisations with OAuth App access restrictions enabled require a one-time
              admin approval before AI Team Builder can read or write. If a Connect attempt
              returns a 403 mentioning OAuth App access, an org admin needs to approve the app at{' '}
              <code className="text-sky-400">github.com/organizations/[your-org]/settings/oauth_application_policy</code>.
            </div>

            {/* Production templates: full multi-agent pipelines, featured larger */}
            <div className="mb-2 flex items-baseline gap-3">
              <h2 className="text-xl font-bold">Production Workflows</h2>
              <span className="text-xs text-zinc-500">Real multi-agent pipelines you can fork.</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-12">
              {TEMPLATES.filter(t => t.category !== 'Starter').map(template => (
                <Card
                  key={template.id}
                  className="bg-zinc-900 border-zinc-800 hover:border-emerald-600 hover:shadow-lg hover:shadow-emerald-900/20 transition-all duration-200 p-5 group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                      {template.category}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                      {template.nodes.length} nodes
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                      {template.edges.length} edges
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-200 mb-1 group-hover:text-emerald-400 transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-sm text-zinc-500 leading-relaxed mb-4">{template.description}</p>
                  <div className="bg-zinc-950 border border-zinc-800 rounded p-2 mb-4 overflow-x-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetPath(`/templates/${template.id}.svg`)}
                      alt={`${template.name} workflow chain diagram`}
                      className="min-w-[600px] w-full h-auto"
                    />
                  </div>
                  <Link href={`/builder?template=${template.id}`}>
                    <Button size="sm" variant="outline" className="border-emerald-700 text-emerald-400 hover:bg-emerald-950 text-xs h-7">
                      Fork &amp; Customize
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>

            {/* Starter templates: 1-step learning examples */}
            <div className="mb-2 flex items-baseline gap-3">
              <h2 className="text-xl font-bold">Hello World</h2>
              <span className="text-xs text-zinc-500">1-step starters for learning the model. Read these, then build something real.</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
              {TEMPLATES.filter(t => t.category === 'Starter').map(template => (
                <Card
                  key={template.id}
                  className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all duration-200 p-4 group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                      {template.nodes.length} nodes
                    </Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-1">{template.name}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed mb-3">{template.description}</p>
                  <Link href={`/builder?template=${template.id}`}>
                    <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-zinc-200 text-[11px] h-6 px-2">
                      Fork &amp; Customize
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          </>
        )}

        {loading && <div className="text-zinc-500">Loading plugins...</div>}

        {/* Plugin list */}
        {!selected && plugins.length > 0 && (
          <>
            <h2 className="text-xl font-bold mb-4">Real-World Plugins</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plugins.map(plugin => (
                <Card
                  key={plugin.name}
                  className="bg-zinc-900 border-zinc-800 hover:border-emerald-600 hover:shadow-lg hover:shadow-emerald-900/20 transition-all duration-200 p-5 cursor-pointer group"
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
                  <h3 className="text-lg font-semibold text-zinc-200 mb-1 group-hover:text-emerald-400 transition-colors">{plugin.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{plugin.description}</p>
                </Card>
              ))}
            </div>
          </>
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

            {/* README / CLAUDE.md preview */}
            {selected.files.find(f => f.path === 'CLAUDE.md') && (
              <details className="mb-6 group">
                <summary className="cursor-pointer text-sm font-semibold text-zinc-300 hover:text-zinc-200 flex items-center gap-2">
                  <span>Plugin Documentation</span>
                  <span className="text-[10px] text-zinc-600 group-open:hidden">Click to expand</span>
                </summary>
                <pre className="mt-2 p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] font-mono text-zinc-400 overflow-x-auto max-h-[400px] whitespace-pre-wrap leading-relaxed">
                  {selected.files.find(f => f.path === 'CLAUDE.md')!.content}
                </pre>
              </details>
            )}

            {/* Component summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {selected.files
                .filter(f => !f.path.startsWith('CLAUDE'))
                .map(file => {
                  const type = file.path.split('/')[0];
                  const name = file.path.split('/').pop()?.replace('.md', '') || '';
                  const colors: Record<string, string> = {
                    commands: '#a855f7', agents: '#ef4444', rules: '#3b82f6',
                    skills: '#22c55e', hooks: '#f97316', protocols: '#6b7280',
                  };
                  const color = colors[type] || '#6b7280';
                  const firstLine = file.content.replace(/^#[^\n]+\n+/, '').split('\n')[0]?.substring(0, 80) || '';

                  return (
                    <Card key={file.path} className="bg-zinc-900 border-zinc-800 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="text-[9px] h-4 px-1.5" style={{ background: color, color: '#fff' }}>
                          {type.replace(/s$/, '')}
                        </Badge>
                        <span className="text-xs font-semibold text-zinc-200 truncate">
                          {type === 'commands' ? `/${name}` : name}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">{firstLine}</div>
                    </Card>
                  );
                })}
            </div>

            {/* File browser */}
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Source files</h3>
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
