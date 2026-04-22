"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBuilderStore } from '@/stores/builder-store';
import podcastFixture from '@/lib/live-test-fixtures/podcast-team.json';

interface FixtureStep {
  agentName: string;
  model: string;
  input: string;
  systemPromptExcerpt: string;
  output: string;
  tokens?: { input: number; output: number };
  durationMs?: number;
}

interface Fixture {
  templateId: string;
  samplePrompt: string;
  vanillaResponse: string;
  steps: FixtureStep[];
}

const FIXTURES: Record<string, Fixture> = {
  'podcast-team': podcastFixture as Fixture,
};

type StepStatus = 'idle' | 'streaming' | 'done';

interface StepState {
  status: StepStatus;
  outputSoFar: string;
}

// Detect which fixture (if any) matches the current builder state.
// Heuristic: match against template name in builder meta.
function detectFixtureForCurrentState(metaName: string): string | null {
  const lowerName = metaName.toLowerCase();
  if (lowerName.includes('podcast')) return 'podcast-team';
  if (lowerName.includes('writing') || lowerName.includes('referee')) return 'writing-team';
  return null;
}

export function StubbedLiveTest() {
  const { meta } = useBuilderStore();
  const fixtureId = detectFixtureForCurrentState(meta.name || '');
  const fixture = fixtureId ? FIXTURES[fixtureId] : null;

  const [prompt, setPrompt] = useState(fixture?.samplePrompt || '');
  const [running, setRunning] = useState(false);
  const [showVanilla, setShowVanilla] = useState(true);
  const [vanillaShown, setVanillaShown] = useState(false);
  const [stepStates, setStepStates] = useState<StepState[]>([]);
  const cancelRef = useRef(false);

  // Reset prompt when switching templates
  useEffect(() => {
    if (fixture) {
      setPrompt(fixture.samplePrompt);
      setStepStates(fixture.steps.map(() => ({ status: 'idle' as StepStatus, outputSoFar: '' })));
    }
  }, [fixtureId, fixture]);

  // Stream a string into a step's outputSoFar field with realistic typing delays
  async function streamStepOutput(stepIndex: number, fullOutput: string) {
    const tokens = fullOutput.split(/(\s+)/);
    let accumulated = '';
    for (const token of tokens) {
      if (cancelRef.current) return;
      accumulated += token;
      setStepStates(prev => {
        const next = [...prev];
        next[stepIndex] = { status: 'streaming', outputSoFar: accumulated };
        return next;
      });
      // 30-90ms per token (variable so it feels natural, not robotic)
      await new Promise(r => setTimeout(r, 30 + Math.random() * 60));
    }
  }

  async function handleRun() {
    if (!fixture || running) return;
    setRunning(true);
    cancelRef.current = false;
    setVanillaShown(false);
    setStepStates(fixture.steps.map(() => ({ status: 'idle' as StepStatus, outputSoFar: '' })));

    if (showVanilla) {
      // Brief pause, then "show" vanilla response (instant, no typing)
      await new Promise(r => setTimeout(r, 400));
      if (cancelRef.current) { setRunning(false); return; }
      setVanillaShown(true);
    }

    // Walk through steps in order, streaming each
    for (let i = 0; i < fixture.steps.length; i++) {
      if (cancelRef.current) break;
      // Brief pause between steps
      await new Promise(r => setTimeout(r, 300));
      if (cancelRef.current) break;
      await streamStepOutput(i, fixture.steps[i].output);
      setStepStates(prev => {
        const next = [...prev];
        next[i] = { status: 'done', outputSoFar: fixture.steps[i].output };
        return next;
      });
    }

    setRunning(false);
  }

  function handleCancel() {
    cancelRef.current = true;
    setRunning(false);
  }

  function handleReset() {
    cancelRef.current = true;
    setRunning(false);
    setVanillaShown(false);
    if (fixture) {
      setStepStates(fixture.steps.map(() => ({ status: 'idle' as StepStatus, outputSoFar: '' })));
    }
  }

  // No fixture for this template — show "demo coming soon"
  if (!fixture) {
    return (
      <div className="h-full overflow-y-auto bg-zinc-950 p-6">
        <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-4 mb-6">
          <div className="text-amber-300 font-semibold text-sm mb-1">Live Test Demo — preview of Sprint 3</div>
          <div className="text-amber-200/80 text-xs leading-relaxed">
            This is a <strong>preview</strong> of the Live Test feature. Outputs are pre-recorded for demonstration.
            Real execution against your own API key ships in Sprint 3.
          </div>
        </div>
        <div className="text-center py-16 text-zinc-500">
          <div className="text-sm mb-2">No demo fixture for this template yet</div>
          <div className="text-xs mb-4">
            Demo currently available for the <strong>Podcast Team</strong> template.
            Open it from the showcase to try the preview.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-6">
      {/* Honesty banner — non-negotiable */}
      <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-4 mb-6">
        <div className="text-amber-300 font-semibold text-sm mb-1">Live Test Demo — preview of Sprint 3</div>
        <div className="text-amber-200/80 text-xs leading-relaxed">
          This is a <strong>preview</strong> of the Live Test feature. Outputs are pre-recorded for demonstration —
          no LLM is being called. Real execution against your own API key ships in Sprint 3,
          along with the &ldquo;Edit and re-run from here&rdquo; capability.
        </div>
      </div>

      {/* Prompt input */}
      <div className="mb-4">
        <label className="text-xs text-zinc-400 mb-2 block">Test prompt (pre-filled with a sample)</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
          rows={5}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-3 text-xs text-zinc-200 font-mono leading-relaxed disabled:opacity-50"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-6">
        {!running ? (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            onClick={handleRun}
            disabled={!prompt.trim()}
          >
            Run Demo
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-red-700 text-red-400 hover:bg-red-950"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-zinc-400 hover:text-zinc-200"
          onClick={handleReset}
          disabled={running}
        >
          Reset
        </Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showVanilla}
            onChange={(e) => setShowVanilla(e.target.checked)}
            disabled={running}
            className="accent-emerald-500"
          />
          Compare to vanilla Claude
        </label>
      </div>

      {/* Vanilla baseline (if toggled on) */}
      {showVanilla && vanillaShown && (
        <div className="mb-6 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="bg-zinc-900 px-4 py-2 flex items-center gap-2 border-b border-zinc-800">
            <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-400">BASELINE</Badge>
            <span className="text-xs text-zinc-300 font-medium">Vanilla Claude (no workflow)</span>
            <span className="ml-auto text-[10px] text-zinc-500">single prompt, no system context</span>
          </div>
          <pre className="p-4 text-[11px] text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">
            {fixture.vanillaResponse}
          </pre>
        </div>
      )}

      {/* Pipeline timeline */}
      <div className="space-y-3">
        <div className="text-xs text-zinc-400 font-medium mb-2">
          Workflow execution ({fixture.steps.length} agents)
        </div>
        {fixture.steps.map((step, i) => {
          const state = stepStates[i] ?? { status: 'idle' as StepStatus, outputSoFar: '' };
          const stepNumber = i + 1;
          return (
            <div
              key={i}
              className={`border rounded-lg overflow-hidden transition-all ${
                state.status === 'streaming'
                  ? 'border-emerald-700 shadow-md shadow-emerald-900/30'
                  : state.status === 'done'
                  ? 'border-zinc-700'
                  : 'border-zinc-800 opacity-60'
              }`}
            >
              <div className="bg-zinc-900 px-4 py-2 flex items-center gap-2 border-b border-zinc-800">
                <div className="w-6 h-6 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {stepNumber}
                </div>
                <span className="text-xs text-zinc-200 font-semibold">{step.agentName}</span>
                <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                  {step.model}
                </Badge>
                {state.status === 'streaming' && (
                  <Badge className="text-[10px] bg-emerald-600 text-white animate-pulse">
                    streaming...
                  </Badge>
                )}
                {state.status === 'done' && step.tokens && (
                  <span className="ml-auto text-[10px] text-zinc-500">
                    {step.tokens.input + step.tokens.output} tokens
                    {step.durationMs && ` · ${(step.durationMs / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>
              {state.status !== 'idle' && (
                <div className="p-4 space-y-3">
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Input</div>
                    <div className="text-[11px] text-zinc-400 font-mono italic">{step.input}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">System prompt excerpt</div>
                    <div className="text-[11px] text-zinc-500 font-mono leading-relaxed">{step.systemPromptExcerpt}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Output</div>
                    <pre className="text-[11px] text-emerald-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {state.outputSoFar}
                      {state.status === 'streaming' && <span className="animate-pulse">▊</span>}
                    </pre>
                  </div>
                  <div className="pt-2 border-t border-zinc-800">
                    <button
                      disabled
                      title="Coming in Sprint 3 — this is a demo of the planned UX."
                      className="text-[11px] text-zinc-600 cursor-not-allowed flex items-center gap-1"
                    >
                      <span className="opacity-60">✏️</span>
                      Edit and re-run from here
                      <Badge variant="outline" className="text-[9px] border-zinc-700 text-zinc-600 ml-1">
                        Sprint 3
                      </Badge>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
