import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Connection,
} from '@xyflow/react';
import { VALID_CONNECTIONS, NODE_COLORS, type PluginNodeType } from '@/lib/plugin-types';
import type { RepoConnection } from '@/lib/gitsync/types';

interface PluginMeta {
  name: string;
  slug: string;
  description: string;
  category: string;
  isPublic: boolean;
}

interface BuilderState {
  // Graph state
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;

  // Selection
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Plugin metadata
  meta: PluginMeta;
  setMeta: (meta: Partial<PluginMeta>) => void;

  // Node operations
  addNode: (type: PluginNodeType, initialData?: Record<string, unknown>) => string;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;

  // Undo/redo
  history: Array<{ nodes: Node[]; edges: Edge[] }>;
  historyIndex: number;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Load/save
  loadGraph: (nodes: Node[], edges: Edge[]) => void;
  isValidConnection: (connection: Edge | Connection) => boolean;

  // Git Sync: connection to a GitHub repo (optional)
  connection: RepoConnection | null;
  setConnection: (c: RepoConnection | null) => void;
  updateConnectionSha: (sha: string) => void;
}

const NODE_DEFAULTS: Record<PluginNodeType, Record<string, unknown>> = {
  rule: { label: 'New Rule', name: '', pathFilter: '', content: '' },
  hook: { label: 'New Hook', event: 'PreToolUse', matcher: '', action: '', once: false },
  skill: { label: 'New Skill', name: '', description: '', instructions: '', filePattern: '', bashPattern: '' },
  command: { label: 'New Command', name: '', description: '', prompt: '' },
  agent: { label: 'New Agent', name: '', model: 'inherit', systemPrompt: '', allowedTools: [] },
  mcp: { label: 'New MCP', serverName: '', command: 'node', args: [], env: {} },
};

export const useBuilderStore = create<BuilderState>()(persist((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  meta: {
    name: '',
    slug: '',
    description: '',
    category: 'general',
    isPublic: false,
  },

  history: [],
  historyIndex: -1,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    const { nodes } = get();
    const sourceNode = nodes.find(n => n.id === connection.source);
    const color = sourceNode ? NODE_COLORS[sourceNode.type as PluginNodeType] : '#888';

    set({
      edges: addEdge(
        { ...connection, animated: true, style: { stroke: color } },
        get().edges,
      ),
    });
    get().pushHistory();
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  setMeta: (partial) => set({ meta: { ...get().meta, ...partial } }),

  addNode: (type, initialData) => {
    const id = `${type}-${Date.now()}`;
    const existingNodes = get().nodes;
    const maxY = existingNodes.length > 0
      ? Math.max(...existingNodes.map(n => n.position.y)) + 120
      : 50;

    const newNode: Node = {
      id,
      type,
      position: { x: 200, y: maxY },
      data: { ...NODE_DEFAULTS[type], ...initialData },
    };

    set({ nodes: [...existingNodes, newNode], selectedNodeId: id });
    get().pushHistory();
    return id;
  },

  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
      ),
    });
  },

  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter(n => n.id !== id),
      edges: get().edges.filter(e => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    });
    get().pushHistory();
  },

  pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    set({ nodes: prev.nodes, edges: prev.edges, historyIndex: historyIndex - 1 });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    set({ nodes: next.nodes, edges: next.edges, historyIndex: historyIndex + 1 });
  },

  loadGraph: (nodes, edges) => {
    set({ nodes, edges, history: [{ nodes, edges }], historyIndex: 0 });
  },

  isValidConnection: (connection) => {
    const { nodes } = get();
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;
    return VALID_CONNECTIONS[sourceNode.type as PluginNodeType]?.includes(targetNode.type as PluginNodeType) ?? false;
  },

  connection: null,
  setConnection: (c) => set({ connection: c }),
  updateConnectionSha: (sha) => {
    const current = get().connection;
    if (!current) return;
    set({ connection: { ...current, lastFetchedSha: sha, loadedAt: Date.now() } });
  },
}),
  {
    name: 'ai-team-builder',
    version: 1,
    migrate: (persistedState: unknown, version: number) => {
      const state = persistedState as Record<string, unknown>;
      if (version === 0) {
        // v0 → v1: no shape changes, just adding version tracking
        return state;
      }
      return state;
    },
    partialize: (state) => ({
      nodes: state.nodes,
      edges: state.edges,
      meta: state.meta,
      connection: state.connection,
    }),
    onRehydrateStorage: () => {
      return (_state, error) => {
        if (error) {
          console.error('Failed to rehydrate builder store:', error);
          // Dynamically import to avoid circular dependency
          import('@/lib/toast').then(({ toast }) => {
            toast('Could not restore saved data. Starting fresh.', 'warning');
          });
        }
      };
    },
    storage: {
      getItem: (name) => {
        try {
          const value = localStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        } catch {
          return null;
        }
      },
      setItem: (name, value) => {
        try {
          localStorage.setItem(name, JSON.stringify(value));
        } catch (e) {
          if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            import('@/lib/toast').then(({ toast }) => {
              toast('Storage full. Export your plugin to avoid data loss.', 'error');
            });
          }
        }
      },
      removeItem: (name) => {
        try {
          localStorage.removeItem(name);
        } catch {
          // Silently fail on remove
        }
      },
    },
  },
));
