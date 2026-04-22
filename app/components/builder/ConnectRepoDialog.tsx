"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/stores/builder-store';
import { parseRepoUrl, loadRepo } from '@/lib/gitsync/load';
import { parsePluginFiles } from '@/lib/import/parse-plugin';
import { getGitHubToken, startGitHubAuth } from '@/lib/github-auth';
import { toast } from '@/lib/toast';

export interface ConnectRepoDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectRepoDialog({ open, onClose }: ConnectRepoDialogProps) {
  const { loadGraph, setMeta, setConnection } = useBuilderStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const handleConnect = async () => {
    setErr(null);
    const parsed = parseRepoUrl(input);
    if (!parsed) {
      setErr('Could not parse. Try: https://github.com/owner/repo or owner/repo@branch');
      return;
    }
    const token = getGitHubToken();
    if (!token) {
      toast('Connect GitHub first.', 'warning');
      startGitHubAuth();
      return;
    }
    setLoading(true);
    try {
      const { connection, files } = await loadRepo(parsed, token);
      const parsedPlugin = parsePluginFiles(files);
      loadGraph(parsedPlugin.nodes, parsedPlugin.edges);
      setMeta({ name: `${connection.owner}/${connection.repo}`, description: `Connected from ${connection.owner}/${connection.repo}@${connection.branch}` });
      setConnection(connection);
      toast(`Connected to ${connection.owner}/${connection.repo}@${connection.branch}`, 'success');
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-lg w-full p-5">
        <h3 className="text-sm font-bold text-zinc-200 mb-2">Connect to a GitHub repo</h3>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          Paste a GitHub URL or <code>owner/repo</code>. The builder will load the plugin files and track
          the repo so saves commit back to the branch. PRs and code review stay on GitHub.
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://github.com/owner/repo  or  owner/repo@branch"
          autoFocus
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 mb-3"
          onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleConnect(); }}
        />
        {err && <div className="text-[11px] text-amber-400 mb-3">{err}</div>}
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading} className="text-zinc-400">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={loading || !input.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {loading ? 'Loading...' : 'Connect'}
          </Button>
        </div>
      </div>
    </div>
  );
}
