"use client";

import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/stores/builder-store';
import { getCommandNodes } from '@/lib/workflow/derive';

interface Props {
  selectedCommandId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

export function WorkflowCommandSelector({ selectedCommandId, onSelect, onCreateNew }: Props) {
  const { nodes } = useBuilderStore();
  const commands = getCommandNodes(nodes);

  if (commands.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">No commands defined yet</span>
        <Button size="sm" variant="outline" className="text-xs h-7 border-purple-600 text-purple-400" onClick={onCreateNew}>
          + New Command
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-400">Workflow for:</span>
      <select
        value={selectedCommandId || ''}
        onChange={e => onSelect(e.target.value)}
        className="h-8 px-3 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-200 outline-none focus:border-emerald-500 min-w-[180px]"
        title={commands.find(c => c.id === selectedCommandId)?.name ? `/${commands.find(c => c.id === selectedCommandId)!.name}` : ''}
      >
        {commands.map(cmd => (
          <option key={cmd.id} value={cmd.id}>
            /{cmd.name || 'untitled'}
          </option>
        ))}
      </select>
      <Button size="sm" variant="ghost" className="text-xs h-7 text-purple-400" onClick={onCreateNew}>
        + New
      </Button>
    </div>
  );
}
