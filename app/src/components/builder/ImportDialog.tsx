"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useBuilderStore } from '@/stores/builder-store';
import { parsePluginFiles } from '@/lib/import/parse-plugin';

export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const { loadGraph, setMeta } = useBuilderStore();

  const handleImport = () => {
    try {
      // Try parsing as JSON export (from our own export)
      const parsed = JSON.parse(input);

      if (parsed.files && Array.isArray(parsed.files)) {
        // Our export format: { files: [{ path, content }] }
        const result = parsePluginFiles(parsed.files);
        loadGraph(result.nodes, result.edges);
        setWarnings(result.warnings);
        if (result.nodes.length > 0 && result.warnings.length === 0) {
          setOpen(false);
          setInput('');
        }
        return;
      }

      // Try as a raw file list
      if (Array.isArray(parsed)) {
        const result = parsePluginFiles(parsed);
        loadGraph(result.nodes, result.edges);
        setWarnings(result.warnings);
        if (result.nodes.length > 0) {
          setOpen(false);
          setInput('');
        }
        return;
      }

      setWarnings(['Unrecognized format. Paste the JSON from "Download JSON" export, or an array of {path, content} objects.']);
    } catch {
      setWarnings(['Invalid JSON. Paste the export JSON or a file list.']);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <span className="inline-flex items-center justify-center rounded-md text-xs text-zinc-400 h-7 w-full px-3 hover:bg-zinc-800 cursor-pointer">
          Import Plugin
        </span>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-200 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Import Plugin</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-zinc-400">Paste export JSON</Label>
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder='Paste the JSON from "Download JSON" export...'
              rows={10}
              className="bg-zinc-950 border-zinc-700 font-mono text-xs mt-1"
            />
          </div>

          {warnings.length > 0 && (
            <div className="text-xs space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className="text-amber-400">{w}</div>
              ))}
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={!input.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            Import
          </Button>
          <p className="text-[10px] text-zinc-600">
            Import replaces all current nodes. Use the JSON from the Export Plugin download.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
