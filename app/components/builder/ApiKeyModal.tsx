"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface ApiKeyModalProps {
  open: boolean;
  onSave: (key: string, persist: boolean) => void;
  onCancel: () => void;
}

export function ApiKeyModal({ open, onSave, onCancel }: ApiKeyModalProps) {
  const [key, setKey] = useState('');
  const [persist, setPersist] = useState(false);

  if (!open) return null;

  const keyLooksValid = /^sk-ant-\w+/.test(key);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-lg w-full p-5">
        <h3 className="text-sm font-bold text-zinc-200 mb-2">Connect your Anthropic API key</h3>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          To run live tests, paste your Anthropic API key. The key is sent only to Anthropic
          via our proxy on <code className="text-emerald-400">jfritz.xyz</code>. We never log
          or store it on our servers. You can find or create a key at{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 underline"
          >
            console.anthropic.com
          </a>.
        </p>
        <label className="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1">API key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-api03-..."
          autoFocus
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 mb-3"
        />
        <label className="flex items-center gap-2 text-xs text-zinc-300 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={persist}
            onChange={(e) => setPersist(e.target.checked)}
            className="accent-emerald-500"
          />
          Remember this key in this browser (localStorage). Leave off to keep it in memory only.
        </label>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-zinc-400">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(key, persist)}
            disabled={!keyLooksValid}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            Save key
          </Button>
        </div>
        {key && !keyLooksValid && (
          <div className="mt-2 text-[10px] text-amber-400">
            Key format looks unusual. Anthropic keys typically start with <code>sk-ant-</code>.
          </div>
        )}
      </div>
    </div>
  );
}
