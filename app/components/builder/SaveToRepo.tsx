"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBuilderStore } from '@/stores/builder-store';
import { getGitHubToken } from '@/lib/github-auth';
import { serializeGraph } from '@/lib/export/serialize';
import { saveToConnectedRepo } from '@/lib/gitsync/save';
import { diffFileMaps, changedFileCount, type FileMap } from '@/lib/gitsync/diff';
import { toast } from '@/lib/toast';
import type { SaveStatus } from '@/lib/gitsync/types';

export interface SaveToRepoProps {
  /** When true, render inline (for Live Test panel). Otherwise header-style. */
  inline?: boolean;
}

/**
 * SaveToRepo: displays current save state, triggers the 5-step Git Data API
 * save sequence, and opens the conflict modal on stale SHA.
 *
 * Also listens for Cmd/Ctrl-S when the builder has focus.
 */
export function SaveToRepo({ inline = false }: SaveToRepoProps) {
  const { nodes, edges, meta, connection, updateConnectionSha } = useBuilderStore();
  const [status, setStatus] = useState<SaveStatus>('clean');
  const [changedCount, setChangedCount] = useState(0);
  const [conflict, setConflict] = useState<{ serverSha?: string } | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Compute current file map from the graph
  const currentFileMap = useMemo<FileMap>(() => {
    if (!connection) return {};
    const result = serializeGraph(nodes, edges, meta.name || 'plugin', '1.0.0', meta.description);
    const map: FileMap = {};
    for (const f of result.files) map[f.path] = f.content;
    return map;
  }, [nodes, edges, meta, connection]);

  // Fast isDirty (no serialize) for instant button enablement
  const isDirty = useMemo(() => {
    if (!connection?.loadedFileMap) return false;
    // Compare serialized maps (this is the debounced heavy check anyway)
    const diff = diffFileMaps(connection.loadedFileMap, currentFileMap);
    return changedFileCount(diff) > 0;
  }, [connection, currentFileMap]);

  // Debounced counter recompute (200ms after last mutation)
  useEffect(() => {
    if (!connection?.loadedFileMap) {
      setChangedCount(0);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const diff = diffFileMaps(connection.loadedFileMap ?? {}, currentFileMap);
      setChangedCount(changedFileCount(diff));
    }, 200) as unknown as number;
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [connection, currentFileMap]);

  // Update status based on isDirty + ephemeral state machine
  useEffect(() => {
    setStatus((s) => {
      if (s === 'saving' || s === 'conflict' || s === 'error') return s;
      return isDirty ? 'dirty' : 'clean';
    });
  }, [isDirty]);

  const doSave = useCallback(async (force = false) => {
    if (!connection) return;
    const token = getGitHubToken();
    if (!token) {
      toast('Connect GitHub first (Share URL flow, or open a plugin from the showcase).', 'warning');
      return;
    }
    setStatus('saving');
    setErrMsg(null);
    const result = await saveToConnectedRepo({
      token,
      connection,
      newFileMap: currentFileMap,
      force,
    });
    if (result.ok) {
      updateConnectionSha(result.newCommitSha);
      // Refresh the connection's loadedFileMap so future diffs compare against just-saved state
      useBuilderStore.setState((s) => ({
        connection: s.connection
          ? { ...s.connection, loadedFileMap: { ...currentFileMap }, lastFetchedSha: result.newCommitSha, loadedAt: Date.now() }
          : null,
      }));
      setStatus('clean');
      toast('Saved to GitHub. View the commit from the repo pill.', 'success');
      return;
    }
    // Failure
    if (result.error.kind === 'stale_sha') {
      setConflict({ serverSha: result.serverHeadSha });
      setStatus('conflict');
    } else {
      setErrMsg(result.error.message);
      setStatus('error');
      toast(`Save failed: ${result.error.message}`, 'error');
    }
  }, [connection, currentFileMap, updateConnectionSha]);

  // Cmd/Ctrl-S handler — only when builder has focus
  useEffect(() => {
    if (!connection) return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 's') return;
      // Only intercept when focus is inside the builder root (not in browser chrome)
      const active = document.activeElement;
      const builderRoot = document.getElementById('builder-root');
      if (!builderRoot || !active || !builderRoot.contains(active)) return;
      e.preventDefault();
      if (status === 'dirty' || status === 'error') doSave(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [connection, status, doSave]);

  if (!connection) return null;

  const buttonLabel = (() => {
    switch (status) {
      case 'saving': return 'Saving...';
      case 'conflict': return 'Conflict — resolve';
      case 'error': return 'Retry save';
      case 'dirty': return `Save (${changedCount} ${changedCount === 1 ? 'change' : 'changes'})`;
      case 'clean': default: return 'Saved';
    }
  })();

  const buttonDisabled = status === 'saving' || status === 'clean';

  return (
    <>
      <div className={inline ? 'flex items-center gap-2' : 'flex items-center gap-2'}>
        <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
          {connection.owner}/{connection.repo}@{connection.branch}
        </Badge>
        <Button
          size="sm"
          className={
            status === 'dirty' ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-7 text-xs'
              : status === 'conflict' ? 'bg-amber-600 hover:bg-amber-700 text-white h-7 text-xs'
              : status === 'error' ? 'bg-red-700 hover:bg-red-800 text-white h-7 text-xs'
              : 'bg-zinc-800 text-zinc-500 h-7 text-xs cursor-default'
          }
          disabled={buttonDisabled}
          onClick={() => status === 'conflict' ? null : doSave(false)}
        >
          {buttonLabel}
        </Button>
        {errMsg && status === 'error' && (
          <span className="text-[10px] text-red-400 max-w-[200px] truncate" title={errMsg}>{errMsg}</span>
        )}
      </div>

      {conflict && (
        <ConflictModal
          serverSha={conflict.serverSha}
          onRefresh={async () => {
            if (!connection) return;
            setConflict(null);
            setStatus('dirty');
            toast('Refresh from repo is coming in a follow-up; for now, reload the page to fetch the latest.', 'warning');
          }}
          onForceOverwrite={async () => {
            setConflict(null);
            await doSave(true);
          }}
          onCancel={() => {
            setConflict(null);
            setStatus(isDirty ? 'dirty' : 'clean');
          }}
        />
      )}
    </>
  );
}

function ConflictModal({
  serverSha,
  onRefresh,
  onForceOverwrite,
  onCancel,
}: {
  serverSha?: string;
  onRefresh: () => void;
  onForceOverwrite: () => void;
  onCancel: () => void;
}) {
  const [confirmingForce, setConfirmingForce] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-zinc-900 border border-amber-700 rounded-lg max-w-lg w-full p-5">
        <h3 className="text-sm font-bold text-amber-300 mb-2">The repo has changed since you loaded it.</h3>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          Someone else (or you in another tab) committed to this branch after you started editing.
          Your local edits aren&rsquo;t lost.
          {serverSha && <> Server HEAD: <code className="text-zinc-300">{serverSha.slice(0, 7)}</code>.</>}
        </p>
        {!confirmingForce ? (
          <div className="space-y-2">
            <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white justify-start" onClick={onRefresh}>
              Refresh from repo (discard local edits)
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-red-700 text-red-400 hover:bg-red-950 justify-start"
              onClick={() => setConfirmingForce(true)}
            >
              Force overwrite (rewrite branch)
            </Button>
            <Button size="sm" variant="ghost" className="w-full text-zinc-400 justify-start" onClick={onCancel}>
              Cancel (keep editing locally)
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-red-300 leading-relaxed">
              This will rewrite the branch and make the upstream commits unreachable from the branch HEAD
              (they persist in the reflog for ~90 days but will NOT appear in <code>git log</code>).
              Anyone who pulled those commits has a dangling copy. Are you sure?
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="bg-red-700 hover:bg-red-800 text-white" onClick={onForceOverwrite}>
                Yes, force overwrite
              </Button>
              <Button size="sm" variant="ghost" className="text-zinc-400" onClick={() => setConfirmingForce(false)}>
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
