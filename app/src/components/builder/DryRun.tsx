"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useBuilderStore } from '@/stores/builder-store';
import { simulate, type SimulationResult } from '@/lib/simulation/engine';
import { NODE_COLORS, type PluginNodeType } from '@/lib/plugin-types';

export function DryRunPanel() {
  const { nodes, edges } = useBuilderStore();
  const [prompt, setPrompt] = useState('');
  const [toolUsed, setToolUsed] = useState('Edit');
  const [filePath, setFilePath] = useState('src/app.py');
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleRun = () => {
    const simResult = simulate(nodes, edges, { prompt, toolUsed, filePath });
    setResult(simResult);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800 space-y-3">
        <h3 className="text-sm font-bold text-zinc-200">Dry Run</h3>

        <div className="space-y-2">
          <div>
            <Label className="text-xs text-zinc-400">Sample Prompt</Label>
            <Input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Fix the type hints in my auth module"
              className="bg-zinc-900 border-zinc-700 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-zinc-400">Tool Used</Label>
              <Input
                value={toolUsed}
                onChange={e => setToolUsed(e.target.value)}
                placeholder="Edit"
                className="bg-zinc-900 border-zinc-700 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">File Path</Label>
              <Input
                value={filePath}
                onChange={e => setFilePath(e.target.value)}
                placeholder="src/app.py"
                className="bg-zinc-900 border-zinc-700 text-xs font-mono"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={nodes.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            Run Simulation
          </Button>
        </div>
      </div>

      {result && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {result.steps.map((step) => (
            <div key={step.stepNumber} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-500">Step {step.stepNumber}</span>
                <span className="text-xs text-zinc-300">{step.event}</span>
              </div>

              {step.firedComponents.length === 0 ? (
                <div className="text-[11px] text-zinc-600 italic pl-4">No components fired</div>
              ) : (
                step.firedComponents.map((comp) => (
                  <div key={comp.nodeId} className="pl-4 flex items-start gap-2">
                    <span className="text-emerald-400 text-xs mt-0.5">+</span>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          className="text-[9px] h-4 px-1"
                          style={{ background: NODE_COLORS[comp.nodeType], color: '#fff' }}
                        >
                          {comp.nodeType}
                        </Badge>
                        <span className="text-xs text-zinc-200 font-medium">{comp.name}</span>
                        <span className="text-[10px] text-zinc-600">~{comp.tokenEstimate} tokens</span>
                      </div>
                      <div className="text-[10px] text-zinc-500">{comp.reason}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}

          <Separator className="bg-zinc-800" />

          <div className="space-y-1 text-xs">
            <div className="text-zinc-300">
              Components: <span className="text-emerald-400 font-semibold">{result.componentsUsed}</span> / {result.componentsTotal} fired
            </div>
            <div className="text-zinc-300">
              Token overhead: <span className="text-emerald-400 font-semibold">~{result.totalTokens}</span> tokens
            </div>
            {result.totalTokens > 2000 && (
              <div className="text-amber-400 text-[11px]">
                Warning: High token overhead. Consider reducing rule/skill content.
              </div>
            )}
          </div>
        </div>
      )}

      {!result && (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">
          Enter a scenario and run the simulation
        </div>
      )}
    </div>
  );
}
