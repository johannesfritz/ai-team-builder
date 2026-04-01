import { useCallback, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
// @ts-expect-error CSS import
import '@xyflow/react/dist/style.css';

import { RuleNode } from './nodes/RuleNode';
import { HookNode } from './nodes/HookNode';
import { SkillNode } from './nodes/SkillNode';
import { CommandNode } from './nodes/CommandNode';
import { AgentNode } from './nodes/AgentNode';
import { VALID_CONNECTIONS, NODE_COLORS, type PluginNodeType } from './types';
import { serializeGraph, formatFileTree } from './serialize';

const nodeTypes = {
  rule: RuleNode,
  hook: HookNode,
  skill: SkillNode,
  command: CommandNode,
  agent: AgentNode,
};

// Sample plugin: a code quality plugin with hook → rule, agent → skill → command
const sampleNodes: Node[] = [
  {
    id: 'hook-1', type: 'hook', position: { x: 50, y: 50 },
    data: { label: 'Pre-Edit Hook', event: 'PreToolUse', matcher: 'Edit|Write', action: '', once: true },
  },
  {
    id: 'rule-1', type: 'rule', position: { x: 400, y: 30 },
    data: { label: 'Code Standards', name: 'code-standards', pathFilter: '**/*.py', content: '# Code Standards\n\n- All functions must have type hints\n- Use async/await for IO operations\n- No wildcard imports' },
  },
  {
    id: 'hook-2', type: 'hook', position: { x: 50, y: 200 },
    data: { label: 'Post-Edit Hook', event: 'PostToolUse', matcher: 'Edit|Write', action: '', once: false },
  },
  {
    id: 'skill-1', type: 'skill', position: { x: 400, y: 200 },
    data: { label: 'Test Runner', name: 'run-tests', description: 'Run test suite after edits', instructions: '# Run Tests\n\nAfter code changes, run pytest.', filePattern: '**/*.py', bashPattern: 'pytest' },
  },
  {
    id: 'agent-1', type: 'agent', position: { x: 50, y: 380 },
    data: { label: 'Code Reviewer', name: 'code-reviewer', model: 'sonnet', systemPrompt: 'You are a senior code reviewer. Check for bugs, security issues, and style violations.', allowedTools: ['Read', 'Grep', 'Glob'] },
  },
  {
    id: 'cmd-1', type: 'command', position: { x: 700, y: 200 },
    data: { label: '/review', name: 'review', description: 'Run code review', prompt: 'Review the current file for bugs, security issues, and style violations.\n\nFocus on:\n1. Type safety\n2. Error handling\n3. Security vulnerabilities' },
  },
];

const sampleEdges: Edge[] = [
  { id: 'e1', source: 'hook-1', target: 'rule-1', animated: true, style: { stroke: NODE_COLORS.hook } },
  { id: 'e2', source: 'hook-2', target: 'skill-1', animated: true, style: { stroke: NODE_COLORS.hook } },
  { id: 'e3', source: 'agent-1', target: 'skill-1', animated: true, style: { stroke: NODE_COLORS.agent } },
  { id: 'e4', source: 'skill-1', target: 'cmd-1', animated: true, style: { stroke: NODE_COLORS.skill } },
];

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(sampleNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(sampleEdges);
  const [serialized, setSerialized] = useState<string | null>(null);
  const { toObject } = useReactFlow();

  // Edge validation: only allow connections defined in VALID_CONNECTIONS
  const isValidConnection = useCallback((connection: Edge | Connection) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    const sourceType = sourceNode.type as PluginNodeType;
    const targetType = targetNode.type as PluginNodeType;

    return VALID_CONNECTIONS[sourceType]?.includes(targetType) ?? false;
  }, [nodes]);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const sourceNode = nodes.find(n => n.id === connection.source);
      const color = sourceNode ? NODE_COLORS[sourceNode.type as PluginNodeType] : '#888';
      setEdges((eds) => addEdge({
        ...connection,
        animated: true,
        style: { stroke: color },
      }, eds));
    },
    [setEdges, nodes]
  );

  // Add new node
  const addNode = useCallback((type: PluginNodeType) => {
    const id = `${type}-${Date.now()}`;
    const defaults: Record<PluginNodeType, Record<string, unknown>> = {
      rule: { label: 'New Rule', name: '', pathFilter: '', content: '' },
      hook: { label: 'New Hook', event: 'PreToolUse', matcher: '', action: '', once: false },
      skill: { label: 'New Skill', name: '', description: '', instructions: '', filePattern: '', bashPattern: '' },
      command: { label: 'New Command', name: '', description: '', prompt: '' },
      agent: { label: 'New Agent', name: '', model: 'sonnet', systemPrompt: '', allowedTools: [] },
    };

    const newNode: Node = {
      id,
      type,
      position: { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: defaults[type],
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  // Serialize graph to .claude-plugin/ structure
  const handleSerialize = useCallback(() => {
    const result = serializeGraph(nodes, edges);
    const tree = formatFileTree(result.files);

    let output = `=== FILE TREE ===\n${tree}\n\n`;

    if (result.errors.length > 0) {
      output += `=== ERRORS ===\n${result.errors.join('\n')}\n\n`;
    }

    for (const file of result.files) {
      output += `=== ${file.path} ===\n${file.content}\n\n`;
    }

    // Also save the React Flow JSON for round-trip test
    const flowJson = toObject();
    output += `=== REACT FLOW STATE (${nodes.length} nodes, ${edges.length} edges) ===\n`;
    output += JSON.stringify(flowJson, null, 2).substring(0, 500) + '...\n';

    setSerialized(output);
  }, [nodes, edges, toObject]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Toolbar */}
      <div style={{ width: 200, padding: 16, borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>BotCamp Spike</h2>

        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>Add Component:</div>
        {(['rule', 'hook', 'skill', 'command', 'agent'] as PluginNodeType[]).map(type => (
          <button
            key={type}
            onClick={() => addNode(type)}
            style={{
              background: NODE_COLORS[type] + '22',
              border: `1px solid ${NODE_COLORS[type]}`,
              borderRadius: 6,
              padding: '6px 10px',
              color: NODE_COLORS[type],
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            + {type}
          </button>
        ))}

        <hr style={{ border: 'none', borderTop: '1px solid #334155', margin: '12px 0' }} />

        <button
          onClick={handleSerialize}
          style={{
            background: '#22c55e22',
            border: '1px solid #22c55e',
            borderRadius: 6,
            padding: '8px 10px',
            color: '#22c55e',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Export .claude-plugin/
        </button>

        <div style={{ fontSize: 10, color: '#64748b', marginTop: 8 }}>
          Nodes: {nodes.length} | Edges: {edges.length}
        </div>
        <div style={{ fontSize: 10, color: '#64748b' }}>
          Valid connections:<br/>
          hook → rule, skill<br/>
          agent → skill<br/>
          skill → command
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          fitView
          style={{ background: '#0f172a' }}
        >
          <Background variant={BackgroundVariant.Dots} color="#334155" gap={20} />
          <Controls style={{ background: '#1e293b', borderColor: '#334155' }} />
          <MiniMap
            nodeColor={(n) => NODE_COLORS[(n.type as PluginNodeType) || 'rule']}
            style={{ background: '#1e293b', border: '1px solid #334155' }}
          />
        </ReactFlow>
      </div>

      {/* Serialization output panel */}
      {serialized && (
        <div style={{
          width: 400,
          padding: 16,
          borderLeft: '1px solid #334155',
          overflow: 'auto',
          fontSize: 11,
          fontFamily: 'monospace',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Export Preview</h3>
            <button
              onClick={() => setSerialized(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}
            >
              x
            </button>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#a7f3d0', lineHeight: 1.5 }}>{serialized}</pre>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
