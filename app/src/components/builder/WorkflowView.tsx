"use client";

import { useState, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useBuilderStore } from '@/stores/builder-store';
import { deriveWorkflow, getCommandNodes, type WorkflowStep } from '@/lib/workflow/derive';
import { WorkflowStepCard } from './WorkflowStep';
import { WorkflowCommandSelector } from './WorkflowCommandSelector';

export function WorkflowView() {
  const { nodes, edges, selectedNodeId, setSelectedNodeId, addNode, updateNodeData } = useBuilderStore();
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);

  // Auto-select first command if none selected
  const commands = useMemo(() => getCommandNodes(nodes), [nodes]);
  useEffect(() => {
    if (!selectedCommandId && commands.length > 0) {
      setSelectedCommandId(commands[0].id);
    }
  }, [commands, selectedCommandId]);

  // Derive workflow from graph
  const steps = useMemo(() => {
    if (!selectedCommandId) return [];
    return deriveWorkflow(selectedCommandId, nodes, edges);
  }, [selectedCommandId, nodes, edges]);

  const totalTokens = steps.reduce((sum, s) => sum + s.tokenEstimate, 0);

  const handleCreateNewCommand = () => {
    addNode('command');
    // Find the newly created command node (latest)
    const latestCommand = nodes
      .filter(n => n.type === 'command')
      .sort((a, b) => b.id.localeCompare(a.id))[0];
    if (latestCommand) {
      setSelectedCommandId(latestCommand.id);
      setSelectedNodeId(latestCommand.id);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-6">
      {/* Command selector */}
      <div className="mb-6">
        <WorkflowCommandSelector
          selectedCommandId={selectedCommandId}
          onSelect={setSelectedCommandId}
          onCreateNew={handleCreateNewCommand}
        />
      </div>

      {/* Workflow timeline */}
      {selectedCommandId && steps.length > 0 ? (
        <>
          {/* Phase groups */}
          <div key={selectedCommandId} className="space-y-2 mb-6">
            {steps.map((step, index) => (
              <WorkflowStepCard
                key={`${selectedCommandId}-${index}`}
                step={step}
                index={index}
                isLast={index === steps.length - 1}
                isSelected={step.nodeId === selectedNodeId}
                onClick={() => setSelectedNodeId(step.nodeId)}
              />
            ))}
          </div>

          <Separator className="bg-zinc-800 my-4" />

          {/* Summary */}
          <div className="flex items-center gap-4 text-xs">
            <div className="text-zinc-400">
              <span className="text-zinc-200 font-semibold">{steps.length}</span> steps
            </div>
            <div className="text-zinc-400">
              <span className="text-zinc-200 font-semibold">~{totalTokens}</span> tokens
            </div>
            {totalTokens > 2000 && (
              <Badge variant="outline" className="text-amber-400 border-amber-600 text-[10px]">
                High token overhead
              </Badge>
            )}
          </div>

          {/* Add step */}
          <div className="mt-6">
            <div className="text-[10px] text-zinc-600 mb-2">Add to this workflow:</div>
            <div className="flex gap-2 flex-wrap">
              {(['rule', 'hook', 'skill', 'agent'] as const).map(type => (
                <Button
                  key={type}
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-6 px-2 text-zinc-500 hover:text-zinc-300"
                  onClick={() => addNode(type)}
                >
                  + {type}
                </Button>
              ))}
            </div>
          </div>
        </>
      ) : selectedCommandId ? (
        <div className="text-center py-16 text-zinc-600">
          <div className="text-sm mb-2">Empty workflow</div>
          <div className="text-xs">Add skills, agents, and rules to build this command&apos;s execution chain.</div>
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-600">
          <div className="text-sm mb-2">No commands in this plugin</div>
          <div className="text-xs mb-4">Create a slash command to see its workflow.</div>
          <Button
            size="sm"
            variant="outline"
            className="border-purple-600 text-purple-400"
            onClick={handleCreateNewCommand}
          >
            + Create Command
          </Button>
        </div>
      )}
    </div>
  );
}
