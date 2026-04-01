"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
      <Select value={selectedCommandId || ''} onValueChange={(v) => { if (v) onSelect(v); }}>
        <SelectTrigger className="w-[200px] h-8 bg-zinc-900 border-zinc-700 text-xs">
          <SelectValue placeholder="Select a command..." />
        </SelectTrigger>
        <SelectContent>
          {commands.map(cmd => (
            <SelectItem key={cmd.id} value={cmd.id} className="text-xs">
              /{cmd.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="ghost" className="text-xs h-7 text-purple-400" onClick={onCreateNew}>
        + New
      </Button>
    </div>
  );
}
