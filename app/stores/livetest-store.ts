// Live Test state — Zustand slice separate from the builder store so that
// live-test runtime state (streaming buffers, run IDs, ephemeral API key)
// doesn't cross-couple with the persistent graph state.

import { create } from 'zustand';

const API_KEY_LS_KEY = 'aitb.anthropic.key';
const BANNER_DISMISSED_LS_KEY = 'aitb.livetest.banner.dismissed';

export type StepStatus = 'idle' | 'queued' | 'streaming' | 'done' | 'error' | 'stale';

export interface StepRunState {
  status: StepStatus;
  outputBuffer: string;
  inputUsedHash: string | null;
  promptHash: string | null;
  tokens: { input: number; output: number } | null;
  durationMs: number | null;
  costUsd: number | null;
  error: { kind: string; message: string } | null;
  startedAt: number | null;
  finishedAt: number | null;
}

export function emptyStepState(): StepRunState {
  return {
    status: 'idle',
    outputBuffer: '',
    inputUsedHash: null,
    promptHash: null,
    tokens: null,
    durationMs: null,
    costUsd: null,
    error: null,
    startedAt: null,
    finishedAt: null,
  };
}

export interface LiveTestState {
  apiKey: string | null;
  apiKeyPersisted: boolean;
  prompt: string;
  showVanilla: boolean;
  vanillaState: StepRunState;
  stepStates: Record<string, StepRunState>;
  runId: string | null;
  globalStatus: 'idle' | 'running' | 'cancelled' | 'error';
  bannerDismissed: boolean;
}

export interface LiveTestActions {
  setApiKey: (key: string | null, persist: boolean) => void;
  forgetApiKey: () => void;
  setPrompt: (p: string) => void;
  setShowVanilla: (v: boolean) => void;
  setStepState: (id: string, patch: Partial<StepRunState>) => void;
  setStepStates: (patch: Record<string, Partial<StepRunState>>) => void;
  setVanillaState: (patch: Partial<StepRunState>) => void;
  startRun: (runId: string) => void;
  completeRun: (outcome: 'idle' | 'cancelled' | 'error') => void;
  resetStepStates: () => void;
  dismissBanner: () => void;
  /** Initialize from localStorage; call from useEffect on mount. */
  hydrateFromStorage: () => void;
  /** Subscribe to storage events for cross-tab sync. Returns unsubscribe. */
  subscribeStorageEvents: () => () => void;
}

export const useLiveTestStore = create<LiveTestState & LiveTestActions>((set, get) => ({
  apiKey: null,
  apiKeyPersisted: false,
  prompt: '',
  showVanilla: true,
  vanillaState: emptyStepState(),
  stepStates: {},
  runId: null,
  globalStatus: 'idle',
  bannerDismissed: false,

  setApiKey: (key, persist) => {
    set({ apiKey: key, apiKeyPersisted: persist });
    if (typeof window === 'undefined') return;
    try {
      if (key && persist) localStorage.setItem(API_KEY_LS_KEY, key);
      else localStorage.removeItem(API_KEY_LS_KEY);
    } catch { /* quota or disabled */ }
  },

  forgetApiKey: () => {
    set({ apiKey: null, apiKeyPersisted: false });
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(API_KEY_LS_KEY); } catch { /* noop */ }
  },

  setPrompt: (p) => set({ prompt: p }),
  setShowVanilla: (v) => set({ showVanilla: v }),

  setStepState: (id, patch) => set(s => ({
    stepStates: { ...s.stepStates, [id]: { ...(s.stepStates[id] ?? emptyStepState()), ...patch } },
  })),

  setStepStates: (patch) => set(s => {
    const next = { ...s.stepStates };
    for (const [id, p] of Object.entries(patch)) {
      next[id] = { ...(next[id] ?? emptyStepState()), ...p };
    }
    return { stepStates: next };
  }),

  setVanillaState: (patch) => set(s => ({ vanillaState: { ...s.vanillaState, ...patch } })),

  startRun: (runId) => set({ runId, globalStatus: 'running' }),

  completeRun: (outcome) => set({ runId: null, globalStatus: outcome }),

  resetStepStates: () => set({
    stepStates: {},
    vanillaState: emptyStepState(),
  }),

  dismissBanner: () => {
    set({ bannerDismissed: true });
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(BANNER_DISMISSED_LS_KEY, '1'); } catch { /* noop */ }
  },

  hydrateFromStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      const key = localStorage.getItem(API_KEY_LS_KEY);
      if (key) set({ apiKey: key, apiKeyPersisted: true });
      const dismissed = localStorage.getItem(BANNER_DISMISSED_LS_KEY) === '1';
      if (dismissed) set({ bannerDismissed: true });
    } catch { /* noop */ }
  },

  subscribeStorageEvents: () => {
    if (typeof window === 'undefined') return () => { /* noop */ };
    const handler = (e: StorageEvent) => {
      if (e.key === API_KEY_LS_KEY) {
        if (e.newValue) {
          set({ apiKey: e.newValue, apiKeyPersisted: true });
        } else {
          // Cleared in another tab
          const { apiKeyPersisted } = get();
          if (apiKeyPersisted) set({ apiKey: null, apiKeyPersisted: false });
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  },
}));
