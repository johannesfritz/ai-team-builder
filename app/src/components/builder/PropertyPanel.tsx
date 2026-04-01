"use client";

import { useMemo } from 'react';
import { useBuilderStore } from '@/stores/builder-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { NODE_COLORS, NODE_LABELS, type PluginNodeType } from '@/lib/plugin-types';
import { GUIDANCE } from '@/lib/guidance';
import { validateNode, type FieldIssue } from '@/lib/validation';

export function PropertyPanel() {
  const { nodes, selectedNodeId, updateNodeData, deleteNode, setSelectedNodeId } = useBuilderStore();
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

        <Separator className="bg-zinc-800" />

        <Button variant="destructive" size="sm" className="w-full" onClick={() => deleteNode(node.id)}>
          Delete Component
        </Button>
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
        <Textarea value={(data.content as string) || ''} onChange={e => update('content', e.target.value)} placeholder="# Rule content..." rows={10} className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
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
        <Textarea value={(data.instructions as string) || ''} onChange={e => update('instructions', e.target.value)} rows={10} placeholder="Step-by-step procedure for Claude to follow..." className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
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
        <Textarea value={(data.prompt as string) || ''} onChange={e => update('prompt', e.target.value)} rows={10} placeholder="Instructions Claude follows when user types /your-command..." className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
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
        <Textarea value={(data.systemPrompt as string) || ''} onChange={e => update('systemPrompt', e.target.value)} rows={8} placeholder="Describe this agent's role, constraints, and approach..." className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </GuidedField>
      <GuidedField fieldKey="allowedTools" label="Allowed Tools" type={type} data={data}>
        <Input
          value={Array.isArray(data.allowedTools) ? (data.allowedTools as string[]).join(', ') : ''}
          onChange={e => update('allowedTools', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
          placeholder="Read, Grep, Glob, Bash, Edit, Write"
          className="bg-zinc-900 border-zinc-700 font-mono text-xs"
        />
      </GuidedField>
    </>
  );
}

function McpFields({ data, update, type }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void; type: PluginNodeType }) {
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
    </>
  );
}
