"use client";

import { useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { RuleNode, HookNode, SkillNode, CommandNode, AgentNode, McpNode } from './nodes';
import { useBuilderStore } from '@/stores/builder-store';
import { NODE_COLORS, type PluginNodeType } from '@/lib/plugin-types';

const nodeTypes = {
  rule: RuleNode,
  hook: HookNode,
  skill: SkillNode,
  command: CommandNode,
  agent: AgentNode,
  mcp: McpNode,
};

export function BuilderCanvas() {
  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect,
    isValidConnection, setSelectedNodeId,
  } = useBuilderStore();

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        className="bg-zinc-950"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#27272a" gap={20} />
        <Controls className="!bg-zinc-900 !border-zinc-700 !rounded-lg [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-700" />
        <MiniMap
          nodeColor={(n) => NODE_COLORS[(n.type as PluginNodeType) || 'rule']}
          className="!bg-zinc-900 !border !border-zinc-700 !rounded-lg"
          maskColor="rgba(0, 0, 0, 0.7)"
        />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
