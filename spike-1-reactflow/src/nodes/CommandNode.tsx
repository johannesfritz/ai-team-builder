import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CommandData } from '../types';
import { NODE_COLORS } from '../types';

export function CommandNode({ data, selected }: NodeProps) {
  const d = data as unknown as CommandData;
  return (
    <div style={{
      border: `2px solid ${selected ? '#fff' : NODE_COLORS.command}`,
      borderRadius: 8,
      background: '#1e293b',
      padding: 12,
      minWidth: 200,
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 13,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: NODE_COLORS.command }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ background: NODE_COLORS.command, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 600, color: '#fff' }}>CMD</span>
        <strong>/{d.name || 'untitled'}</strong>
      </div>

      {d.description && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{d.description}</div>
      )}

      <div style={{ fontSize: 11, color: '#94a3b8', maxHeight: 40, overflow: 'hidden' }}>
        {d.prompt ? d.prompt.substring(0, 80) + '...' : 'No prompt template'}
      </div>
    </div>
  );
}
