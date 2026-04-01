"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBuilderStore } from '@/stores/builder-store';
import { NODE_COLORS, NODE_LABELS, type PluginNodeType } from '@/lib/plugin-types';
import { GUIDANCE } from '@/lib/guidance';
import { getCommandNodes } from '@/lib/workflow/derive';

interface CreateNodeDialogProps {
  open: boolean;
  onClose: () => void;
  presetType?: PluginNodeType;
}

const TOOL_OPTIONS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Agent'];

export function CreateNodeDialog({ open, onClose, presetType }: CreateNodeDialogProps) {
  const [step, setStep] = useState<'type' | 'fields' | 'connect'>('type');
  const [selectedType, setSelectedType] = useState<PluginNodeType | null>(presetType || null);
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [connectTo, setConnectTo] = useState<string>('');
  const { nodes, addNode } = useBuilderStore();
  const store = useBuilderStore();

  const commands = getCommandNodes(nodes);

  // Auto-advance to fields if type is preset
  useEffect(() => {
    if (open && presetType && step === 'type') {
      handleSelectType(presetType);
    }
  }, [open, presetType]);

  const resetAndClose = () => {
    setStep('type');
    setSelectedType(presetType || null);
    setFields({});
    setConnectTo('');
    onClose();
  };

  const handleSelectType = (type: PluginNodeType) => {
    setSelectedType(type);
    setStep('fields');
    // Pre-fill defaults
    const defaults: Record<string, unknown> = {};
    const guidance = GUIDANCE[type];
    for (const [key, fg] of Object.entries(guidance.fields)) {
      defaults[key] = '';
    }
    if (type === 'agent') defaults.model = 'inherit';
    if (type === 'hook') defaults.event = 'PreToolUse';
    if (type === 'hook') defaults.once = true;
    if (type === 'mcp') defaults.command = 'node';
    setFields(defaults);
  };

  const handleCreate = () => {
    if (!selectedType) return;

    // Derive label from name
    const name = (fields.name as string) || (fields.serverName as string) || '';
    const label = name
      ? name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : `New ${NODE_LABELS[selectedType]}`;

    // Create the node with all data in one call
    const newNodeId = addNode(selectedType, { ...fields, label });

    // Create edge to selected command if applicable
    if (connectTo && newNodeId && selectedType !== 'command') {
      // For skills: skill → command edge
      if (selectedType === 'skill') {
        store.onConnect({ source: newNodeId, target: connectTo, sourceHandle: null, targetHandle: null });
      }
      // For hooks: hook connects to rules/skills (not directly to commands)
      // For agents: agent → skill (user wires this manually or we can auto-connect)
    }

    resetAndClose();
  };

  const updateField = (key: string, value: unknown) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  if (!open) return null;

  const guidance = selectedType ? GUIDANCE[selectedType] : null;
  const nameField = fields.name as string || fields.serverName as string || '';
  const canCreate = selectedType && nameField.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-200 max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            {selectedType && (
              <Badge style={{ background: NODE_COLORS[selectedType] }} className="text-white text-[10px]">
                {NODE_LABELS[selectedType]}
              </Badge>
            )}
            {step === 'type' ? 'Add Component' : step === 'fields' ? `New ${NODE_LABELS[selectedType!]}` : 'Connect'}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Choose type */}
        {step === 'type' && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">What kind of component do you want to add?</p>
            {(['agent', 'skill', 'command', 'rule', 'hook', 'mcp'] as PluginNodeType[]).map(type => (
              <button
                key={type}
                className="w-full flex items-start gap-3 p-3 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors text-left"
                onClick={() => handleSelectType(type)}
              >
                <Badge style={{ background: NODE_COLORS[type] }} className="text-white text-[10px] mt-0.5 shrink-0">
                  {NODE_LABELS[type]}
                </Badge>
                <div>
                  <div className="text-xs font-medium text-zinc-200">{NODE_LABELS[type]}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{GUIDANCE[type].what}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Required fields */}
        {step === 'fields' && selectedType && guidance && (
          <div className="space-y-4">
            {/* Type guidance */}
            <div className="p-3 bg-zinc-800 rounded-lg">
              <div className="text-[11px] text-zinc-400">{guidance.when}</div>
              <div className="text-[10px] text-emerald-500 mt-1">{guidance.tip}</div>
            </div>

            {/* Fields */}
            {Object.entries(guidance.fields).map(([key, fg]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs text-zinc-400">
                  {fg.label}
                  {fg.required && <span className="text-red-400 ml-0.5">*</span>}
                </Label>
                <div className="text-[10px] text-zinc-600 mb-1">{fg.help}</div>

                {key === 'event' ? (
                  <Select value={(fields[key] as string) || 'PreToolUse'} onValueChange={v => updateField(key, v)}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-700 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PreToolUse">PreToolUse (before tool, can block)</SelectItem>
                      <SelectItem value="PostToolUse">PostToolUse (after tool)</SelectItem>
                      <SelectItem value="UserPromptSubmit">UserPromptSubmit</SelectItem>
                      <SelectItem value="SubagentStart">SubagentStart</SelectItem>
                      <SelectItem value="SessionStart">SessionStart</SelectItem>
                    </SelectContent>
                  </Select>
                ) : key === 'model' ? (
                  <Select value={(fields[key] as string) || 'inherit'} onValueChange={v => updateField(key, v)}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-700 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Inherit (use parent model)</SelectItem>
                      <SelectItem value="haiku">Haiku (fast, cheap)</SelectItem>
                      <SelectItem value="sonnet">Sonnet (balanced)</SelectItem>
                      <SelectItem value="opus">Opus (most capable)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : key === 'once' ? (
                  <Select value={fields[key] ? 'true' : 'false'} onValueChange={v => updateField(key, v === 'true')}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-700 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes (recommended)</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                ) : key === 'allowedTools' ? (
                  <div className="flex flex-wrap gap-1.5">
                    {TOOL_OPTIONS.map(tool => {
                      const selected = Array.isArray(fields[key]) && (fields[key] as string[]).includes(tool);
                      return (
                        <button
                          key={tool}
                          type="button"
                          className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                            selected
                              ? 'bg-emerald-900 border-emerald-600 text-emerald-300'
                              : 'bg-zinc-950 border-zinc-700 text-zinc-500 hover:border-zinc-500'
                          }`}
                          onClick={() => {
                            const current = Array.isArray(fields[key]) ? (fields[key] as string[]) : [];
                            updateField(key, selected ? current.filter(t => t !== tool) : [...current, tool]);
                          }}
                        >
                          {tool}
                        </button>
                      );
                    })}
                  </div>
                ) : key === 'content' || key === 'instructions' || key === 'prompt' || key === 'systemPrompt' ? (
                  <Textarea
                    value={(fields[key] as string) || ''}
                    onChange={e => updateField(key, e.target.value)}
                    placeholder={fg.placeholder}
                    rows={6}
                    className="bg-zinc-950 border-zinc-700 font-mono text-xs"
                  />
                ) : (
                  <Input
                    value={(fields[key] as string) || ''}
                    onChange={e => updateField(key, e.target.value)}
                    placeholder={fg.example || fg.placeholder}
                    className="bg-zinc-950 border-zinc-700 text-xs"
                  />
                )}
              </div>
            ))}

            {/* Connection step for non-commands */}
            {selectedType !== 'command' && commands.length > 0 && (
              <>
                <div className="border-t border-zinc-800 pt-3">
                  <Label className="text-xs text-zinc-400">Connect to command (optional)</Label>
                  <div className="text-[10px] text-zinc-600 mb-1.5">Wire this component into an existing command&apos;s workflow.</div>
                  <select
                    value={connectTo}
                    onChange={e => setConnectTo(e.target.value)}
                    className="w-full h-8 px-3 bg-zinc-950 border border-zinc-700 rounded-md text-xs text-zinc-200 outline-none"
                  >
                    <option value="">None (standalone)</option>
                    {commands.map(cmd => (
                      <option key={cmd.id} value={cmd.id}>/{cmd.name || 'untitled'}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" size="sm" className="flex-1 text-zinc-400" onClick={() => { setStep('type'); setSelectedType(presetType || null); }}>
                Back
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                onClick={handleCreate}
                disabled={!canCreate}
              >
                Create {NODE_LABELS[selectedType]}
              </Button>
            </div>
            {!canCreate && nameField.length === 0 && (
              <div className="text-[10px] text-amber-400 text-center">Enter a name to create</div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
