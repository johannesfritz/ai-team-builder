"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBuilderStore } from '@/stores/builder-store';
import { useLiveTestStore, emptyStepState, type StepRunState } from '@/stores/livetest-store';
import { getCommandNodes } from '@/lib/workflow/derive';
import { topoOrderFrom, runStep } from '@/lib/livetest/runner';
import { buildStepInput } from '@/lib/livetest/input';
import { transitiveDescendants } from '@/lib/livetest/dag';
import { shortHash } from '@/lib/livetest/hash';
import { computeCost, formatCost, DEFAULT_OUTPUT_BUDGET, PRICING_USD_PER_MTOK } from '@/lib/anthropic/pricing';
import type { AgentData } from '@/lib/plugin-types';
import { ApiKeyModal } from './ApiKeyModal';

/**
 * Find the first agent step to execute: the root-most agent in the command's
 * upstream. If the workflow has multiple disconnected chains feeding the command,
 * we pick the one topologically earliest.
 */
function findStartAgent(commandId: string, nodes: ReturnType<typeof useBuilderStore.getState>['nodes'], edges: ReturnType<typeof useBuilderStore.getState>['edges']): string | null {
  // Walk backward from command through agent edges only
  const agentIds = new Set(nodes.filter(n => n.type === 'agent').map(n => n.id));
  const ancestors = new Set<string>();
  const queue = [commandId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (e.target === cur && agentIds.has(e.source) && !ancestors.has(e.source)) {
        ancestors.add(e.source);
        queue.push(e.source);
      }
    }
  }
  if (!ancestors.size) return null;
  // Root = agent in ancestors with no agent parent in ancestors
  const roots = [...ancestors].filter(id =>
    !edges.some(e => e.target === id && agentIds.has(e.source) && ancestors.has(e.source)),
  );
  if (!roots.length) return [...ancestors][0];
  // Preserve node-array order
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  roots.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  return roots[0];
}

export function LiveTest() {
  const { nodes, edges } = useBuilderStore();
  const {
    apiKey, apiKeyPersisted, prompt, showVanilla, vanillaState, stepStates,
    globalStatus, bannerDismissed,
    setApiKey, forgetApiKey, setPrompt, setShowVanilla, setStepState, setVanillaState,
    appendStepOutput, appendVanillaOutput,
    startRun, completeRun, resetStepStates, dismissBanner, hydrateFromStorage, subscribeStorageEvents,
  } = useLiveTestStore();

  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Hydrate from localStorage on mount, subscribe to cross-tab storage events
  useEffect(() => {
    hydrateFromStorage();
    return subscribeStorageEvents();
  }, [hydrateFromStorage, subscribeStorageEvents]);

  const commands = useMemo(() => getCommandNodes(nodes), [nodes]);
  const selectedCommandId = commands[0]?.id ?? null;

  const startAgentId = useMemo(
    () => (selectedCommandId ? findStartAgent(selectedCommandId, nodes, edges) : null),
    [selectedCommandId, nodes, edges],
  );

  const orderedStepIds = useMemo(
    () => (startAgentId ? topoOrderFrom(startAgentId, nodes, edges) : []),
    [startAgentId, nodes, edges],
  );

  const orderedStepNodes = useMemo(
    () => orderedStepIds.map(id => nodes.find(n => n.id === id)!).filter(Boolean),
    [orderedStepIds, nodes],
  );

  const firstModel = useMemo(() => {
    if (!orderedStepNodes.length) return 'sonnet';
    return (orderedStepNodes[0].data as unknown as AgentData).model ?? 'sonnet';
  }, [orderedStepNodes]);

  const estimatedCostUsd = useMemo(() => {
    let total = 0;
    for (const step of orderedStepNodes) {
      const d = step.data as unknown as AgentData;
      const budget = (d as AgentData & { maxOutputTokens?: number }).maxOutputTokens ?? DEFAULT_OUTPUT_BUDGET;
      const inputEst = Math.ceil((d.systemPrompt?.length ?? 0) / 4) + Math.ceil(prompt.length / 4);
      const cost = computeCost({ model: d.model, inputTokens: inputEst, outputTokens: budget });
      if (cost !== null) total += cost;
    }
    // Baseline
    if (showVanilla) {
      const baselineCost = computeCost({
        model: firstModel,
        inputTokens: Math.ceil(prompt.length / 4),
        outputTokens: DEFAULT_OUTPUT_BUDGET,
      });
      if (baselineCost !== null) total += baselineCost;
    }
    return total;
  }, [orderedStepNodes, prompt, showVanilla, firstModel]);

  const totalTokensInput = Object.values(stepStates).reduce((s, st) => s + (st.tokens?.input ?? 0), 0)
    + (showVanilla ? (vanillaState.tokens?.input ?? 0) : 0);
  const totalTokensOutput = Object.values(stepStates).reduce((s, st) => s + (st.tokens?.output ?? 0), 0)
    + (showVanilla ? (vanillaState.tokens?.output ?? 0) : 0);
  const totalCost = Object.values(stepStates).reduce((s, st) => s + (st.costUsd ?? 0), 0)
    + (showVanilla ? (vanillaState.costUsd ?? 0) : 0);
  const baselineCost = vanillaState.costUsd ?? 0;

  const handleRunFromStart = useCallback(async () => {
    if (!apiKey) { setApiKeyModalOpen(true); return; }
    if (!orderedStepNodes.length) return;

    resetStepStates();
    const newRunId = `run-${Date.now()}`;
    startRun(newRunId);

    const controller = new AbortController();
    abortRef.current = controller;

    const stepOutputs: Record<string, string> = {};

    // Kick off the vanilla baseline in parallel with first step
    if (showVanilla) {
      setVanillaState({ ...emptyStepState(), status: 'streaming', inputUsed: prompt, systemPromptUsed: '', startedAt: Date.now() });
      runStep({
        apiKey,
        model: firstModel,
        systemPrompt: '',
        userInput: prompt,
        signal: controller.signal,
      }, {
        onTextDelta: (t) => {
          appendVanillaOutput(t);
        },
        onFinal: (final) => {
          setVanillaState({
            status: 'done',
            outputBuffer: final.outputText,
            tokens: { input: final.inputTokens, output: final.outputTokens },
            durationMs: final.durationMs,
            costUsd: final.costUsd,
            finishedAt: Date.now(),
          });
        },
        onError: (err) => {
          setVanillaState({
            status: 'error',
            error: { kind: err.kind, message: err.message },
            outputBuffer: err.partialOutput,
            finishedAt: Date.now(),
          });
        },
      });
    }

    // Walk workflow steps sequentially
    for (const stepId of orderedStepIds) {
      if (useLiveTestStore.getState().runId !== newRunId) break;
      const stepNode = nodes.find(n => n.id === stepId);
      if (!stepNode) continue;
      const d = stepNode.data as unknown as AgentData;
      const input = buildStepInput(stepId, nodes, edges, { userPrompt: prompt, stepOutputs });
      const promptHash = await shortHash(d.systemPrompt ?? '');
      const inputUsedHash = await shortHash(input);
      const budget = (d as AgentData & { maxOutputTokens?: number }).maxOutputTokens ?? DEFAULT_OUTPUT_BUDGET;

      setStepState(stepId, {
        ...emptyStepState(),
        status: 'streaming',
        inputUsed: input,
        systemPromptUsed: d.systemPrompt ?? '',
        promptHash,
        inputUsedHash,
        startedAt: Date.now(),
      });

      let finalized = false;
      await runStep({
        apiKey,
        model: d.model,
        systemPrompt: d.systemPrompt ?? '',
        userInput: input,
        maxOutputTokens: budget,
        signal: controller.signal,
      }, {
        onTextDelta: (t) => {
          appendStepOutput(stepId, t);
        },
        onFinal: (final) => {
          finalized = true;
          stepOutputs[stepId] = final.outputText;
          setStepState(stepId, {
            status: 'done',
            outputBuffer: final.outputText,
            tokens: { input: final.inputTokens, output: final.outputTokens },
            durationMs: final.durationMs,
            costUsd: final.costUsd,
            finishedAt: Date.now(),
          });
        },
        onError: (err) => {
          setStepState(stepId, {
            status: 'error',
            error: { kind: err.kind, message: err.message },
            outputBuffer: err.partialOutput,
            finishedAt: Date.now(),
          });
        },
      });

      if (!finalized) {
        // Error occurred; halt the run.
        completeRun('error');
        abortRef.current = null;
        return;
      }
    }

    completeRun('idle');
    abortRef.current = null;
  }, [apiKey, orderedStepNodes, orderedStepIds, nodes, edges, prompt, showVanilla, firstModel,
    resetStepStates, startRun, setStepState, setVanillaState, appendStepOutput, appendVanillaOutput, completeRun]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    completeRun('cancelled');
  }, [completeRun]);

  const handleEditSave = useCallback((stepId: string) => {
    const step = nodes.find(n => n.id === stepId);
    if (!step) return;
    const oldPrompt = (step.data as unknown as AgentData).systemPrompt ?? '';
    if (oldPrompt === editDraft) { setEditingStepId(null); return; }

    // Same mutation path the PropertyPanel uses — triggers builder dirty tracking
    useBuilderStore.getState().updateNodeData(stepId, { systemPrompt: editDraft });

    // Mark this step and all transitive descendants stale
    const stale = transitiveDescendants(stepId, edges);
    stale.add(stepId);
    const patch: Record<string, Partial<StepRunState>> = {};
    for (const id of stale) {
      const cur = useLiveTestStore.getState().stepStates[id];
      if (cur && cur.status !== 'idle') patch[id] = { status: 'stale' };
    }
    useLiveTestStore.getState().setStepStates(patch);

    setEditingStepId(null);
  }, [nodes, edges, editDraft]);

  const handleReRunFromStep = useCallback(async (startId: string) => {
    if (!apiKey) { setApiKeyModalOpen(true); return; }

    const newRunId = `run-${Date.now()}`;
    startRun(newRunId);

    const controller = new AbortController();
    abortRef.current = controller;

    // Rebuild stepOutputs from cached outputs of steps NOT being re-run
    const rerunIds = new Set([startId, ...transitiveDescendants(startId, edges)]);
    const stepOutputs: Record<string, string> = {};
    for (const [id, s] of Object.entries(useLiveTestStore.getState().stepStates)) {
      if (!rerunIds.has(id) && s.status === 'done') stepOutputs[id] = s.outputBuffer;
    }

    // Re-run the affected steps in topological order
    const toRunIds = orderedStepIds.filter(id => rerunIds.has(id));
    for (const stepId of toRunIds) {
      if (useLiveTestStore.getState().runId !== newRunId) break;
      const stepNode = nodes.find(n => n.id === stepId);
      if (!stepNode) continue;
      const d = stepNode.data as unknown as AgentData;
      const input = buildStepInput(stepId, nodes, edges, { userPrompt: prompt, stepOutputs });
      const promptHash = await shortHash(d.systemPrompt ?? '');
      const inputUsedHash = await shortHash(input);
      const budget = (d as AgentData & { maxOutputTokens?: number }).maxOutputTokens ?? DEFAULT_OUTPUT_BUDGET;

      setStepState(stepId, {
        ...emptyStepState(),
        status: 'streaming',
        inputUsed: input,
        systemPromptUsed: d.systemPrompt ?? '',
        promptHash,
        inputUsedHash,
        startedAt: Date.now(),
      });

      let finalized = false;
      await runStep({
        apiKey,
        model: d.model,
        systemPrompt: d.systemPrompt ?? '',
        userInput: input,
        maxOutputTokens: budget,
        signal: controller.signal,
      }, {
        onTextDelta: (t) => {
          appendStepOutput(stepId, t);
        },
        onFinal: (final) => {
          finalized = true;
          stepOutputs[stepId] = final.outputText;
          setStepState(stepId, {
            status: 'done',
            outputBuffer: final.outputText,
            tokens: { input: final.inputTokens, output: final.outputTokens },
            durationMs: final.durationMs,
            costUsd: final.costUsd,
            finishedAt: Date.now(),
          });
        },
        onError: (err) => {
          setStepState(stepId, {
            status: 'error',
            error: { kind: err.kind, message: err.message },
            outputBuffer: err.partialOutput,
            finishedAt: Date.now(),
          });
        },
      });

      if (!finalized) {
        completeRun('error');
        abortRef.current = null;
        return;
      }
    }

    completeRun('idle');
    abortRef.current = null;
  }, [apiKey, nodes, edges, prompt, orderedStepIds, startRun, setStepState, appendStepOutput, completeRun]);

  // Empty states
  if (!selectedCommandId) {
    return (
      <div className="h-full overflow-y-auto bg-zinc-950 p-6 text-center text-zinc-600">
        <div className="text-sm mb-2">No command in this plugin</div>
        <div className="text-xs">Live Test runs a prompt through a command&apos;s workflow. Create a command first.</div>
      </div>
    );
  }

  if (!orderedStepNodes.length) {
    return (
      <div className="h-full overflow-y-auto bg-zinc-950 p-6 text-center text-zinc-600">
        <div className="text-sm mb-2">No agents connected to this command</div>
        <div className="text-xs">Wire at least one agent into the workflow to live-test it.</div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full overflow-y-auto bg-zinc-950 p-6">
        {/* Fidelity gap banner (non-intrusive, dismissible) */}
        {!bannerDismissed && (
          <div className="bg-zinc-900 border border-zinc-800 rounded p-3 mb-4 text-[11px] text-zinc-400 leading-relaxed flex items-start gap-2">
            <div className="flex-1">
              <strong className="text-zinc-300">Live Test executes each agent as a single Claude API call against your key.</strong>
              {' '}It does not run hooks, auto-load skills on file pattern, or execute tool calls. For prompt-hardening this is what you want.
              For full runtime verification, install the plugin in Claude Code.
            </div>
            <button onClick={dismissBanner} className="text-zinc-600 hover:text-zinc-300 text-base leading-none">×</button>
          </div>
        )}

        {/* API key status */}
        {apiKey && apiKeyPersisted && (
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded p-2 mb-3 text-[11px] text-zinc-500">
            <span>Key stored in this browser (localStorage).</span>
            <button onClick={forgetApiKey} className="text-zinc-400 hover:text-zinc-200 underline">Forget key</button>
          </div>
        )}
        {apiKey && !apiKeyPersisted && (
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded p-2 mb-3 text-[11px] text-zinc-500">
            <span>Key in memory only (clears on tab reload).</span>
            <button onClick={() => setApiKeyModalOpen(true)} className="text-zinc-400 hover:text-zinc-200 underline">Change key</button>
          </div>
        )}

        {/* Prompt input */}
        <label className="text-xs text-zinc-400 mb-2 block">Test prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={globalStatus === 'running'}
          rows={5}
          placeholder="Paste the input your workflow should process..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-3 text-xs text-zinc-200 font-mono leading-relaxed disabled:opacity-50 mb-3"
        />

        {/* Controls */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {globalStatus !== 'running' ? (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleRunFromStart}
              disabled={!prompt.trim()}
            >
              Run from start
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
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showVanilla}
              onChange={(e) => setShowVanilla(e.target.checked)}
              disabled={globalStatus === 'running'}
              className="accent-emerald-500"
            />
            Compare to vanilla Claude
          </label>
          <div className="ml-auto text-[11px] text-zinc-500">
            Est. cost: ~{formatCost(estimatedCostUsd)} · {orderedStepNodes.length} agents · approximate (±20%)
          </div>
        </div>

        {/* Vanilla baseline panel */}
        {showVanilla && vanillaState.status !== 'idle' && (
          <div className="mb-6 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="bg-zinc-900 px-4 py-2 flex items-center gap-2 border-b border-zinc-800">
              <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-400">BASELINE</Badge>
              <span className="text-xs text-zinc-300 font-medium">Vanilla Claude (no workflow)</span>
              {vanillaState.status === 'streaming' && (
                <Badge className="text-[10px] bg-emerald-600 text-white animate-pulse">streaming...</Badge>
              )}
              {vanillaState.status === 'done' && vanillaState.tokens && (
                <span className="ml-auto text-[10px] text-zinc-500">
                  {vanillaState.tokens.input + vanillaState.tokens.output} tok · {((vanillaState.durationMs ?? 0) / 1000).toFixed(1)}s · {formatCost(vanillaState.costUsd ?? 0)}
                </span>
              )}
            </div>
            <pre className="p-4 text-[11px] text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
              {vanillaState.outputBuffer}
              {vanillaState.status === 'streaming' && <span className="animate-pulse">▊</span>}
              {vanillaState.status === 'error' && vanillaState.error && (
                <div className="mt-2 text-amber-400">Error: {vanillaState.error.message}</div>
              )}
            </pre>
          </div>
        )}

        {/* Workflow timeline */}
        <div className="space-y-3">
          <div className="text-xs text-zinc-400 font-medium mb-2">
            Workflow execution ({orderedStepNodes.length} agents)
          </div>
          {orderedStepNodes.map((node, i) => {
            const state = stepStates[node.id] ?? emptyStepState();
            const d = node.data as unknown as AgentData;
            const isEditing = editingStepId === node.id;
            const modelPriced = PRICING_USD_PER_MTOK[d.model] !== undefined;
            return (
              <div
                key={node.id}
                className={`border rounded-lg overflow-hidden transition-all ${
                  state.status === 'streaming' ? 'border-emerald-700 shadow-md shadow-emerald-900/30'
                    : state.status === 'done' ? 'border-zinc-700'
                    : state.status === 'error' ? 'border-red-800'
                    : state.status === 'stale' ? 'border-zinc-800 opacity-50 border-dashed'
                    : 'border-zinc-800 opacity-60'
                }`}
              >
                <div className="bg-zinc-900 px-4 py-2 flex items-center gap-2 border-b border-zinc-800 flex-wrap">
                  <div className="w-6 h-6 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-xs text-zinc-200 font-semibold">{d.name}</span>
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                    {d.model}
                  </Badge>
                  {!modelPriced && (
                    <Badge variant="outline" className="text-[10px] border-amber-700 text-amber-400">
                      no pricing
                    </Badge>
                  )}
                  {state.status === 'streaming' && (
                    <Badge className="text-[10px] bg-emerald-600 text-white animate-pulse">streaming...</Badge>
                  )}
                  {state.status === 'stale' && (
                    <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-500">
                      stale
                    </Badge>
                  )}
                  {state.status === 'done' && state.tokens && (
                    <span className="ml-auto text-[10px] text-zinc-500">
                      {state.tokens.input + state.tokens.output} tok · {((state.durationMs ?? 0) / 1000).toFixed(1)}s · {formatCost(state.costUsd ?? 0)}
                    </span>
                  )}
                </div>
                {(state.status !== 'idle' || isEditing) && (
                  <div className="p-4 space-y-3">
                    {!isEditing && state.status !== 'idle' && (
                      <>
                        {/* INPUT — what arrived at this agent */}
                        {state.inputUsed && (
                          <details className="group">
                            <summary className="cursor-pointer text-[10px] text-zinc-500 uppercase tracking-wider mb-1 hover:text-zinc-300">
                              Input received <span className="text-zinc-600 normal-case ml-1">({state.inputUsed.length.toLocaleString()} chars from {i === 0 ? 'user prompt' : `step ${i}`})</span>
                            </summary>
                            <pre className="mt-1 text-[11px] text-sky-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto bg-zinc-950/60 p-2 rounded border border-zinc-800">
                              {state.inputUsed}
                            </pre>
                          </details>
                        )}

                        {/* SYSTEM PROMPT — what shaped this agent's behavior */}
                        {state.systemPromptUsed && (
                          <details className="group">
                            <summary className="cursor-pointer text-[10px] text-zinc-500 uppercase tracking-wider mb-1 hover:text-zinc-300">
                              System prompt <span className="text-zinc-600 normal-case ml-1">({state.systemPromptUsed.length.toLocaleString()} chars · click Edit to modify)</span>
                            </summary>
                            <pre className="mt-1 text-[11px] text-violet-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto bg-zinc-950/60 p-2 rounded border border-zinc-800">
                              {state.systemPromptUsed}
                            </pre>
                          </details>
                        )}

                        {/* OUTPUT — what this agent produced */}
                        <div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                            Output <span className="text-zinc-600 normal-case ml-1">({state.outputBuffer.length.toLocaleString()} chars{i < orderedStepNodes.length - 1 ? ` · passed to step ${i + 2}` : ''})</span>
                          </div>
                          <pre className="text-[11px] text-emerald-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[320px] overflow-y-auto">
                            {state.outputBuffer}
                            {state.status === 'streaming' && <span className="animate-pulse">▊</span>}
                          </pre>
                          {state.status === 'error' && state.error && (
                            <div className="mt-2 text-xs text-amber-400">
                              <strong>{state.error.kind}:</strong> {state.error.message}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    {isEditing && (
                      <div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Editing system prompt</div>
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={8}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-[11px] text-zinc-200 font-mono"
                        />
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleEditSave(node.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" className="text-zinc-400" onClick={() => setEditingStepId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    {!isEditing && (
                      <div className="pt-2 border-t border-zinc-800 flex gap-2 items-center flex-wrap">
                        <button
                          className="text-[11px] text-zinc-500 hover:text-zinc-200 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={globalStatus === 'running'}
                          onClick={() => { setEditingStepId(node.id); setEditDraft(d.systemPrompt ?? ''); }}
                        >
                          Edit prompt
                        </button>
                        {state.status === 'stale' && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-6 text-[11px]"
                            disabled={globalStatus === 'running'}
                            onClick={() => handleReRunFromStep(node.id)}
                          >
                            Re-run from step {i + 1}
                          </Button>
                        )}
                        {state.status === 'error' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-700 text-amber-400 h-6 text-[11px]"
                            disabled={globalStatus === 'running'}
                            onClick={() => handleReRunFromStep(node.id)}
                          >
                            Retry from step {i + 1}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Total */}
        {globalStatus !== 'running' && (totalTokensInput > 0 || totalTokensOutput > 0) && (
          <div className="mt-4 text-[11px] text-zinc-500 border-t border-zinc-800 pt-3">
            Total: {totalTokensInput.toLocaleString()} input · {totalTokensOutput.toLocaleString()} output · {formatCost(totalCost)}
            {showVanilla && baselineCost > 0 && (
              <span className="ml-2 text-zinc-600">(includes baseline: {formatCost(baselineCost)})</span>
            )}
          </div>
        )}
      </div>

      <ApiKeyModal
        open={apiKeyModalOpen}
        onSave={(key, persist) => {
          setApiKey(key, persist);
          setApiKeyModalOpen(false);
          // Resume the run that prompted for key
          setTimeout(() => handleRunFromStart(), 50);
        }}
        onCancel={() => setApiKeyModalOpen(false)}
      />
    </>
  );
}
