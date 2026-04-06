"use client";

import { useMemo, useState } from 'react';
import { useBuilderStore } from '@/stores/builder-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { FullscreenEditor } from './FullscreenEditor';
import { type Node, type Edge } from '@xyflow/react';
import { NODE_COLORS, NODE_LABELS, VALID_CONNECTIONS, type PluginNodeType } from '@/lib/plugin-types';
import { GUIDANCE } from '@/lib/guidance';
import { validateNode } from '@/lib/validation';

export function PropertyPanel() {
  const { nodes, edges, selectedNodeId, updateNodeData, deleteNode, setSelectedNodeId } = useBuilderStore();
  const node = nodes.find(n => n.id === selectedNodeId);

  if (!node) {
    return (
      <div className="h-full bg-zinc-950 p-4 text-zinc-500 text-sm flex items-center justify-center">
        Select a component to edit
      </div>
    );
  }

  const type = node.type as PluginNodeType;
  const data = node.data as Record<string, unknown>;
  const color = NODE_COLORS[type];
  const guidance = GUIDANCE[type];

  const update = (field: string, value: unknown) => {
    updateNodeData(node.id, { [field]: value });
  };

  return (
    <div className="h-full bg-zinc-950 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge style={{ background: color }} className="text-white text-[10px]">
              {NODE_LABELS[type]}
            </Badge>
            <span className="text-sm font-medium text-zinc-200">Properties</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedNodeId(null)} className="text-zinc-500 h-6 w-6 p-0">
            x
          </Button>
        </div>
        {/* Type explainer */}
        <div className="text-[11px] text-zinc-500 leading-relaxed">{guidance.what}</div>
        <div className="text-[10px] text-emerald-600 mt-1">{guidance.tip}</div>
      </div>

      <div className="p-4 space-y-4">
        {/* Common: label */}
        <GuidedField fieldKey="label" label="Display Label" type={type} data={data}>
          <Input value={(data.label as string) || ''} onChange={e => update('label', e.target.value)} className="bg-zinc-900 border-zinc-700" />
        </GuidedField>

        {/* Type-specific fields */}
        {type === 'rule' && <RuleFields data={data} update={update} type={type} />}
        {type === 'hook' && <HookFields data={data} update={update} type={type} />}
        {type === 'skill' && <SkillFields data={data} update={update} type={type} />}
        {type === 'command' && <CommandFields data={data} update={update} type={type} />}
        {type === 'agent' && <AgentFields data={data} update={update} type={type} />}
        {type === 'mcp' && <McpFields data={data} update={update} type={type} />}

        <ConnectionsSection nodeId={node.id} nodeType={type} nodes={nodes} edges={edges} />

        <Separator className="bg-zinc-800" />

        <DeleteButton nodeId={node.id} nodeName={(data.name as string) || (data.label as string) || NODE_LABELS[type]} onDelete={deleteNode} />
      </div>
    </div>
  );
}

// Field wrapper with validation + help
function GuidedField({ fieldKey, label, type, data, children }: {
  fieldKey: string;
  label: string;
  type: PluginNodeType;
  data: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const guidance = GUIDANCE[type];
  const fieldGuide = guidance.fields[fieldKey];
  const validation = useMemo(() => validateNode(type, data), [type, data]);

  const error = validation.errors.find(e => e.field === fieldKey);
  const warning = validation.warnings.find(w => w.field === fieldKey);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center">
        <Label className="text-xs text-zinc-400">
          {label}
          {fieldGuide?.required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
        {fieldGuide && <HelpTooltip text={fieldGuide.help} example={fieldGuide.example} />}
      </div>
      {children}
      {error && <div className="text-[10px] text-red-400">{error.message}</div>}
      {warning && !error && <div className="text-[10px] text-amber-400">{warning.message}</div>}
    </div>
  );
}

function ExpandableText({ value, onChange, fieldKey, label, typeBadge, typeColor, placeholder, help }: {
  value: string; onChange: (v: string) => void; fieldKey: string;
  label: string; typeBadge?: string; typeColor?: string; placeholder?: string; help?: string;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const preview = value ? value.substring(0, 120).replace(/\n/g, ' ') + (value.length > 120 ? '...' : '') : '';
  const lines = value ? value.split('\n').length : 0;

  return (
    <>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 cursor-pointer hover:border-zinc-600 transition-colors group"
        onClick={() => setEditorOpen(true)}
      >
        {value ? (
          <>
            <div className="text-xs font-mono text-zinc-400 leading-relaxed line-clamp-3">{preview}</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-zinc-600">{lines} lines · ~{Math.ceil(value.length / 4)} tokens</span>
              <span className="text-[10px] text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">Click to expand</span>
            </div>
          </>
        ) : (
          <div className="text-xs text-zinc-600 italic">{placeholder || 'Click to write...'}</div>
        )}
      </div>
      <FullscreenEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        value={value}
        onChange={onChange}
        title={label}
        typeBadge={typeBadge}
        typeColor={typeColor}
        placeholder={placeholder}
        help={help}
      />
    </>
  );
}

function RuleFields({ data, update, type }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void; type: PluginNodeType }) {
  return (
    <>
      <GuidedField fieldKey="name" label="Rule Name" type={type} data={data}>
        <Input value={(data.name as string) || ''} onChange={e => update('name', e.target.value)} placeholder="e.g. code-standards" className="bg-zinc-900 border-zinc-700" />
      </GuidedField>
      <GuidedField fieldKey="pathFilter" label="Path Filter" type={type} data={data}>
        <Input value={(data.pathFilter as string) || ''} onChange={e => update('pathFilter', e.target.value)} placeholder="e.g. **/*.py" className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </GuidedField>
      <GuidedField fieldKey="content" label="Content" type={type} data={data}>
        <ExpandableText
          value={(data.content as string) || ''}
          onChange={v => update('content', v)}
          fieldKey="content" label="Rule Content"
          typeBadge="Rule" typeColor={NODE_COLORS.rule}
          placeholder="# Rule content..."
          help={GUIDANCE.rule.fields.content?.help}
        />
      </GuidedField>
    </>
  );
}

function HookFields({ data, update, type }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void; type: PluginNodeType }) {
  return (
    <>
      <GuidedField fieldKey="event" label="Event" type={type} data={data}>
        <Select value={(data.event as string) || 'PreToolUse'} onValueChange={v => update('event', v)}>
          <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="PreToolUse">PreToolUse (before tool, can block)</SelectItem>
            <SelectItem value="PostToolUse">PostToolUse (after tool)</SelectItem>
            <SelectItem value="UserPromptSubmit">UserPromptSubmit (before prompt)</SelectItem>
            <SelectItem value="SubagentStart">SubagentStart (agent spawns)</SelectItem>
            <SelectItem value="SessionStart">SessionStart (session begins)</SelectItem>
          </SelectContent>
        </Select>
      </GuidedField>
      <GuidedField fieldKey="matcher" label="Matcher" type={type} data={data}>
        <Input value={(data.matcher as string) || ''} onChange={e => update('matcher', e.target.value)} placeholder="e.g. Edit|Write" className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </GuidedField>
      <GuidedField fieldKey="action" label="Action" type={type} data={data}>
        <Input value={(data.action as string) || ''} onChange={e => update('action', e.target.value)} placeholder='Auto-generated from edges' className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </GuidedField>
      <GuidedField fieldKey="once" label="Once per session" type={type} data={data}>
        <Select value={data.once ? 'true' : 'false'} onValueChange={v => update('once', v === 'true')}>
          <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes (recommended for context injection)</SelectItem>
            <SelectItem value="false">No (fires every time)</SelectItem>
          </SelectContent>
        </Select>
      </GuidedField>
    </>
  );
}

function SkillFields({ data, update, type }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void; type: PluginNodeType }) {
  return (
    <>
      <GuidedField fieldKey="name" label="Skill Name" type={type} data={data}>
        <Input value={(data.name as string) || ''} onChange={e => update('name', e.target.value)} placeholder="e.g. run-tests" className="bg-zinc-900 border-zinc-700" />
      </GuidedField>
      <GuidedField fieldKey="description" label="Description" type={type} data={data}>
        <Textarea value={(data.description as string) || ''} onChange={e => update('description', e.target.value)} placeholder="When should this skill be used? Include trigger phrases." rows={3} className="bg-zinc-900 border-zinc-700 text-xs" />
      </GuidedField>
      <GuidedField fieldKey="filePattern" label="File Pattern" type={type} data={data}>
        <Input value={(data.filePattern as string) || ''} onChange={e => update('filePattern', e.target.value)} placeholder="e.g. **/*.py" className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </GuidedField>
      <GuidedField fieldKey="bashPattern" label="Bash Pattern" type={type} data={data}>
        <Input value={(data.bashPattern as string) || ''} onChange={e => update('bashPattern', e.target.value)} placeholder="e.g. pytest|npm test" className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </GuidedField>
      <GuidedField fieldKey="instructions" label="Instructions" type={type} data={data}>
        <ExpandableText
          value={(data.instructions as string) || ''}
          onChange={v => update('instructions', v)}
          fieldKey="instructions" label="Skill Instructions"
          typeBadge="Skill" typeColor={NODE_COLORS.skill}
          placeholder="Step-by-step procedure for Claude to follow..."
          help={GUIDANCE.skill.fields.instructions?.help}
        />
      </GuidedField>
    </>
  );
}

function CommandFields({ data, update, type }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void; type: PluginNodeType }) {
  return (
    <>
      <GuidedField fieldKey="name" label="Command Name" type={type} data={data}>
        <Input value={(data.name as string) || ''} onChange={e => update('name', e.target.value)} placeholder="e.g. review (without /)" className="bg-zinc-900 border-zinc-700" />
      </GuidedField>
      <GuidedField fieldKey="description" label="Description" type={type} data={data}>
        <Input value={(data.description as string) || ''} onChange={e => update('description', e.target.value)} placeholder="Brief description for command help" className="bg-zinc-900 border-zinc-700" />
      </GuidedField>
      <GuidedField fieldKey="prompt" label="Prompt Template" type={type} data={data}>
        <ExpandableText
          value={(data.prompt as string) || ''}
          onChange={v => update('prompt', v)}
          fieldKey="prompt" label="Prompt Template"
          typeBadge="Command" typeColor={NODE_COLORS.command}
          placeholder="Instructions Claude follows when user types /your-command..."
          help={GUIDANCE.command.fields.prompt?.help}
        />
      </GuidedField>
    </>
  );
}

function AgentFields({ data, update, type }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void; type: PluginNodeType }) {
  return (
    <>
      <GuidedField fieldKey="name" label="Agent Name" type={type} data={data}>
        <Input value={(data.name as string) || ''} onChange={e => update('name', e.target.value)} placeholder="e.g. code-reviewer" className="bg-zinc-900 border-zinc-700" />
      </GuidedField>
      <GuidedField fieldKey="model" label="Model" type={type} data={data}>
        <Select value={(data.model as string) || 'sonnet'} onValueChange={v => update('model', v)}>
          <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">Inherit (use parent model)</SelectItem>
            <SelectItem value="haiku">Haiku (fast, cheap)</SelectItem>
            <SelectItem value="sonnet">Sonnet (balanced)</SelectItem>
            <SelectItem value="opus">Opus (most capable)</SelectItem>
          </SelectContent>
        </Select>
      </GuidedField>
      <GuidedField fieldKey="systemPrompt" label="System Prompt" type={type} data={data}>
        <ExpandableText
          value={(data.systemPrompt as string) || ''}
          onChange={v => update('systemPrompt', v)}
          fieldKey="systemPrompt" label="System Prompt"
          typeBadge="Agent" typeColor={NODE_COLORS.agent}
          placeholder="Describe this agent's role, constraints, and approach..."
          help={GUIDANCE.agent.fields.systemPrompt?.help}
        />
      </GuidedField>
      <GuidedField fieldKey="allowedTools" label="Allowed Tools" type={type} data={data}>
        <ToolChips
          selected={Array.isArray(data.allowedTools) ? (data.allowedTools as string[]) : []}
          onChange={tools => update('allowedTools', tools)}
        />
      </GuidedField>
    </>
  );
}

function McpFields({ data, update, type }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void; type: PluginNodeType }) {
  const env = (data.env as Record<string, string>) || {};
  const envEntries = Object.entries(env);

  const updateEnv = (oldKey: string, newKey: string, value: string) => {
    const newEnv = { ...env };
    if (oldKey !== newKey) delete newEnv[oldKey];
    newEnv[newKey] = value;
    update('env', newEnv);
  };

  const removeEnvKey = (key: string) => {
    const newEnv = { ...env };
    delete newEnv[key];
    update('env', newEnv);
  };

  const addEnvKey = () => {
    update('env', { ...env, '': '' });
  };

  return (
    <>
      <GuidedField fieldKey="serverName" label="Server Name" type={type} data={data}>
        <Input value={(data.serverName as string) || ''} onChange={e => update('serverName', e.target.value)} placeholder="e.g. my-api" className="bg-zinc-900 border-zinc-700" />
      </GuidedField>
      <GuidedField fieldKey="command" label="Command" type={type} data={data}>
        <Input value={(data.command as string) || ''} onChange={e => update('command', e.target.value)} placeholder="e.g. node, python3" className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </GuidedField>
      <GuidedField fieldKey="args" label="Arguments" type={type} data={data}>
        <Input
          value={Array.isArray(data.args) ? (data.args as string[]).join(', ') : ''}
          onChange={e => update('args', e.target.value.split(',').map(a => a.trim()).filter(Boolean))}
          placeholder="e.g. dist/server.js"
          className="bg-zinc-900 border-zinc-700 font-mono text-xs"
        />
      </GuidedField>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-zinc-400">Environment Variables</Label>
          <button type="button" onClick={addEnvKey} className="text-[10px] text-emerald-500 hover:text-emerald-400">+ Add</button>
        </div>
        {envEntries.length === 0 && (
          <div className="text-[10px] text-zinc-600 italic">No environment variables. Click + Add to set API keys, config, etc.</div>
        )}
        {envEntries.map(([key, value], i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <Input
              value={key}
              onChange={e => updateEnv(key, e.target.value, value)}
              placeholder="KEY"
              className="bg-zinc-900 border-zinc-700 font-mono text-[10px] flex-1"
            />
            <Input
              value={value}
              onChange={e => updateEnv(key, key, e.target.value)}
              placeholder="value"
              className="bg-zinc-900 border-zinc-700 font-mono text-[10px] flex-1"
            />
            <button type="button" onClick={() => removeEnvKey(key)} className="text-zinc-600 hover:text-red-400 text-xs px-1">×</button>
          </div>
        ))}
      </div>
    </>
  );
}

function ConnectionsSection({ nodeId, nodeType, nodes, edges }: {
  nodeId: string; nodeType: PluginNodeType; nodes: Node[]; edges: Edge[];
}) {
  const { onConnect } = useBuilderStore();
  const validTargetTypes = VALID_CONNECTIONS[nodeType];
  if (validTargetTypes.length === 0) return null;

  const outgoingEdges = edges.filter(e => e.source === nodeId);
  const connectedTargetIds = new Set(outgoingEdges.map(e => e.target));
  const availableTargets = nodes.filter(
    n => validTargetTypes.includes(n.type as PluginNodeType) && !connectedTargetIds.has(n.id) && n.id !== nodeId
  );

  const handleConnect = (targetId: string) => {
    if (!targetId) return;
    onConnect({ source: nodeId, target: targetId, sourceHandle: null, targetHandle: null });
  };

  const handleDisconnect = (edgeId: string) => {
    useBuilderStore.getState().onEdgesChange([{ id: edgeId, type: 'remove' }]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-zinc-400">Connections</Label>
      {outgoingEdges.map(edge => {
        const target = nodes.find(n => n.id === edge.target);
        const targetName = target
          ? ((target.data as Record<string, unknown>).name as string || (target.data as Record<string, unknown>).label as string || target.type)
          : 'Unknown';
        return (
          <div key={edge.id} className="flex items-center justify-between bg-zinc-900 rounded px-2 py-1.5 border border-zinc-800">
            <span className="text-[11px] text-zinc-300">&rarr; {targetName}</span>
            <button type="button" onClick={() => handleDisconnect(edge.id)} className="text-zinc-600 hover:text-red-400 text-xs px-1">&times;</button>
          </div>
        );
      })}
      {availableTargets.length > 0 && (
        <select
          className="w-full h-7 px-2 bg-zinc-900 border border-zinc-700 rounded text-[11px] text-zinc-400"
          value=""
          onChange={e => handleConnect(e.target.value)}
        >
          <option value="">+ Connect to...</option>
          {availableTargets.map(t => (
            <option key={t.id} value={t.id}>
              {(t.data as Record<string, unknown>).name as string || (t.data as Record<string, unknown>).label as string || t.type} ({t.type})
            </option>
          ))}
        </select>
      )}
      {outgoingEdges.length === 0 && availableTargets.length === 0 && (
        <div className="text-[10px] text-zinc-600 italic">No compatible targets. Add a {validTargetTypes.join(' or ')} first.</div>
      )}
    </div>
  );
}

function DeleteButton({ nodeId, nodeName, onDelete }: { nodeId: string; nodeName: string; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-zinc-400 text-center">Delete &quot;{nodeName}&quot;? This cannot be undone.</div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1 text-zinc-400" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" className="flex-1" onClick={() => { onDelete(nodeId); setConfirming(false); }}>
            Delete
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="sm" className="w-full text-red-400 hover:text-red-300 hover:bg-red-950" onClick={() => setConfirming(true)}>
      Delete Component
    </Button>
  );
}

const TOOL_OPTIONS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Agent'];

function ToolChips({ selected, onChange }: { selected: string[]; onChange: (tools: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TOOL_OPTIONS.map(tool => {
        const isSelected = selected.includes(tool);
        return (
          <button
            key={tool}
            type="button"
            className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
              isSelected
                ? 'bg-emerald-900 border-emerald-600 text-emerald-300'
                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500'
            }`}
            onClick={() => onChange(isSelected ? selected.filter(t => t !== tool) : [...selected, tool])}
          >
            {tool}
          </button>
        );
      })}
    </div>
  );
}
