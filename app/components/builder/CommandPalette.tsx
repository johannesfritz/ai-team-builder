"use client";

import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { useBuilderStore } from '@/stores/builder-store';
import { NODE_LABELS, type PluginNodeType } from '@/lib/plugin-types';

interface Props {
  onExport: () => void;
  onImport: () => void;
  onShare?: () => void;
}

export function CommandPalette({ onExport, onImport, onShare }: Props) {
  const [open, setOpen] = useState(false);
  const { addNode, undo, redo } = useBuilderStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const runAction = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  if (!open) return null;

  const nodeTypes: PluginNodeType[] = ['rule', 'hook', 'skill', 'command', 'agent', 'mcp'];

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-start justify-center pt-[20vh]" onClick={() => setOpen(false)}>
      <div className="w-[480px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <Command className="[&_[cmdk-input]]:bg-transparent [&_[cmdk-input]]:text-zinc-200 [&_[cmdk-input]]:text-sm [&_[cmdk-input]]:outline-none [&_[cmdk-input]]:w-full [&_[cmdk-input]]:p-4 [&_[cmdk-input]]:border-b [&_[cmdk-input]]:border-zinc-800">
          <Command.Input placeholder="Type a command..." />
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="p-4 text-sm text-zinc-500 text-center">No results</Command.Empty>

            <Command.Group heading="Create" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-zinc-500 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
              {nodeTypes.map(type => (
                <Command.Item
                  key={type}
                  onSelect={() => runAction(() => addNode(type))}
                  className="px-3 py-2 rounded-lg text-sm text-zinc-300 cursor-pointer data-[selected=true]:bg-zinc-800 flex items-center gap-2"
                >
                  + {NODE_LABELS[type]}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-zinc-500 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
              <Command.Item onSelect={() => runAction(onExport)} className="px-3 py-2 rounded-lg text-sm text-zinc-300 cursor-pointer data-[selected=true]:bg-zinc-800">
                Export Plugin
              </Command.Item>
              <Command.Item onSelect={() => runAction(onImport)} className="px-3 py-2 rounded-lg text-sm text-zinc-300 cursor-pointer data-[selected=true]:bg-zinc-800">
                Import Plugin
              </Command.Item>
              {onShare && (
                <Command.Item onSelect={() => runAction(onShare)} className="px-3 py-2 rounded-lg text-sm text-zinc-300 cursor-pointer data-[selected=true]:bg-zinc-800">
                  Share URL
                </Command.Item>
              )}
              <Command.Item onSelect={() => runAction(undo)} className="px-3 py-2 rounded-lg text-sm text-zinc-300 cursor-pointer data-[selected=true]:bg-zinc-800">
                Undo
              </Command.Item>
              <Command.Item onSelect={() => runAction(redo)} className="px-3 py-2 rounded-lg text-sm text-zinc-300 cursor-pointer data-[selected=true]:bg-zinc-800">
                Redo
              </Command.Item>
            </Command.Group>
          </Command.List>
          <div className="p-2 border-t border-zinc-800 text-[10px] text-zinc-600 text-center">
            Cmd+K to toggle / Up/Down to navigate / Enter to select / Esc to close
          </div>
        </Command>
      </div>
    </div>
  );
}
