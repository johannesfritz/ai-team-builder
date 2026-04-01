"use client";

import { useBuilderStore } from '@/stores/builder-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { NODE_COLORS, NODE_LABELS, type PluginNodeType } from '@/lib/plugin-types';

export function PropertyPanel() {
  const { nodes, selectedNodeId, updateNodeData, deleteNode, setSelectedNodeId } = useBuilderStore();
  const node = nodes.find(n => n.id === selectedNodeId);

  if (!node) {
    return (
      <div className="h-full bg-zinc-950 p-4 text-zinc-500 text-sm flex items-center justify-center">
        Select a node to edit
      </div>
    );
  }

  const type = node.type as PluginNodeType;
  const data = node.data as Record<string, unknown>;
  const color = NODE_COLORS[type];

  const update = (field: string, value: unknown) => {
    updateNodeData(node.id, { [field]: value });
  };

  return (
    <div className="h-full bg-zinc-950 overflow-y-auto">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
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

      <div className="p-4 space-y-4">
        {/* Common: label */}
        <Field label="Display Label">
          <Input value={(data.label as string) || ''} onChange={e => update('label', e.target.value)} className="bg-zinc-900 border-zinc-700" />
        </Field>

        {/* Type-specific fields */}
        {type === 'rule' && <RuleFields data={data} update={update} />}
        {type === 'hook' && <HookFields data={data} update={update} />}
        {type === 'skill' && <SkillFields data={data} update={update} />}
        {type === 'command' && <CommandFields data={data} update={update} />}
        {type === 'agent' && <AgentFields data={data} update={update} />}
        {type === 'mcp' && <McpFields data={data} update={update} />}

        <Separator className="bg-zinc-800" />

        <Button variant="destructive" size="sm" className="w-full" onClick={() => deleteNode(node.id)}>
          Delete Node
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-zinc-400">{label}</Label>
      {children}
    </div>
  );
}

function RuleFields({ data, update }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Rule Name">
        <Input value={(data.name as string) || ''} onChange={e => update('name', e.target.value)} placeholder="e.g. code-standards" className="bg-zinc-900 border-zinc-700" />
      </Field>
      <Field label="Path Filter (glob)">
        <Input value={(data.pathFilter as string) || ''} onChange={e => update('pathFilter', e.target.value)} placeholder="e.g. **/*.py" className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </Field>
      <Field label="Content (Markdown)">
        <Textarea value={(data.content as string) || ''} onChange={e => update('content', e.target.value)} placeholder="# Rule content..." rows={8} className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </Field>
    </>
  );
}

function HookFields({ data, update }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Event">
        <Select value={(data.event as string) || 'PreToolUse'} onValueChange={v => update('event', v)}>
          <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="PreToolUse">PreToolUse</SelectItem>
            <SelectItem value="PostToolUse">PostToolUse</SelectItem>
            <SelectItem value="UserPromptSubmit">UserPromptSubmit</SelectItem>
            <SelectItem value="SubagentStart">SubagentStart</SelectItem>
            <SelectItem value="SessionStart">SessionStart</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Matcher (tool names or regex)">
        <Input value={(data.matcher as string) || ''} onChange={e => update('matcher', e.target.value)} placeholder="e.g. Edit|Write" className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </Field>
      <Field label="Action (shell command)">
        <Input value={(data.action as string) || ''} onChange={e => update('action', e.target.value)} placeholder='Auto-generated from edges if empty' className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </Field>
      <Field label="Once per session">
        <Select value={data.once ? 'true' : 'false'} onValueChange={v => update('once', v === 'true')}>
          <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}

function SkillFields({ data, update }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Skill Name">
        <Input value={(data.name as string) || ''} onChange={e => update('name', e.target.value)} placeholder="e.g. run-tests" className="bg-zinc-900 border-zinc-700" />
      </Field>
      <Field label="Description">
        <Input value={(data.description as string) || ''} onChange={e => update('description', e.target.value)} className="bg-zinc-900 border-zinc-700" />
      </Field>
      <Field label="File Pattern (glob)">
        <Input value={(data.filePattern as string) || ''} onChange={e => update('filePattern', e.target.value)} placeholder="e.g. **/*.py" className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </Field>
      <Field label="Bash Pattern (regex)">
        <Input value={(data.bashPattern as string) || ''} onChange={e => update('bashPattern', e.target.value)} placeholder="e.g. pytest|npm test" className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </Field>
      <Field label="Instructions (Markdown)">
        <Textarea value={(data.instructions as string) || ''} onChange={e => update('instructions', e.target.value)} rows={8} className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </Field>
    </>
  );
}

function CommandFields({ data, update }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Command Name (without /)">
        <Input value={(data.name as string) || ''} onChange={e => update('name', e.target.value)} placeholder="e.g. review" className="bg-zinc-900 border-zinc-700" />
      </Field>
      <Field label="Description">
        <Input value={(data.description as string) || ''} onChange={e => update('description', e.target.value)} className="bg-zinc-900 border-zinc-700" />
      </Field>
      <Field label="Prompt Template (Markdown)">
        <Textarea value={(data.prompt as string) || ''} onChange={e => update('prompt', e.target.value)} rows={8} className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </Field>
    </>
  );
}

function AgentFields({ data, update }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Agent Name">
        <Input value={(data.name as string) || ''} onChange={e => update('name', e.target.value)} className="bg-zinc-900 border-zinc-700" />
      </Field>
      <Field label="Model">
        <Select value={(data.model as string) || 'sonnet'} onValueChange={v => update('model', v)}>
          <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sonnet">Sonnet</SelectItem>
            <SelectItem value="opus">Opus</SelectItem>
            <SelectItem value="haiku">Haiku</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="System Prompt">
        <Textarea value={(data.systemPrompt as string) || ''} onChange={e => update('systemPrompt', e.target.value)} rows={6} className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </Field>
      <Field label="Allowed Tools (comma-separated)">
        <Input
          value={Array.isArray(data.allowedTools) ? (data.allowedTools as string[]).join(', ') : ''}
          onChange={e => update('allowedTools', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
          placeholder="Read, Grep, Glob, Bash"
          className="bg-zinc-900 border-zinc-700 font-mono text-xs"
        />
      </Field>
    </>
  );
}

function McpFields({ data, update }: { data: Record<string, unknown>; update: (f: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Server Name">
        <Input value={(data.serverName as string) || ''} onChange={e => update('serverName', e.target.value)} className="bg-zinc-900 border-zinc-700" />
      </Field>
      <Field label="Command">
        <Input value={(data.command as string) || ''} onChange={e => update('command', e.target.value)} placeholder="e.g. node" className="bg-zinc-900 border-zinc-700 font-mono text-xs" />
      </Field>
      <Field label="Args (comma-separated)">
        <Input
          value={Array.isArray(data.args) ? (data.args as string[]).join(', ') : ''}
          onChange={e => update('args', e.target.value.split(',').map(a => a.trim()).filter(Boolean))}
          className="bg-zinc-900 border-zinc-700 font-mono text-xs"
        />
      </Field>
    </>
  );
}
