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
  addNode: (type: PluginNodeType) => void;
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

  addNode: (type) => {
    const id = `${type}-${Date.now()}`;
    const existingNodes = get().nodes;
    const maxY = existingNodes.length > 0
      ? Math.max(...existingNodes.map(n => n.position.y)) + 120
      : 50;

    const newNode: Node = {
      id,
      type,
      position: { x: 200, y: maxY },
      data: { ...NODE_DEFAULTS[type] },
    };

    set({ nodes: [...existingNodes, newNode], selectedNodeId: id });
    get().pushHistory();
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
}),
  {
    name: 'ai-team-builder',
    partialize: (state) => ({
      nodes: state.nodes,
      edges: state.edges,
      meta: state.meta,
    }),
  },
));
