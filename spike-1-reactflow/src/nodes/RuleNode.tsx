import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { RuleData } from '../types';
import { NODE_COLORS } from '../types';

export function RuleNode({ data, selected }: NodeProps) {
  const d = data as unknown as RuleData;
  return (
    <div style={{
      border: `2px solid ${selected ? '#fff' : NODE_COLORS.rule}`,
      borderRadius: 8,
      background: '#1e293b',
      padding: 12,
      minWidth: 220,
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 13,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: NODE_COLORS.rule }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ background: NODE_COLORS.rule, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 600, color: '#fff' }}>RULE</span>
        <strong>{d.name || 'Untitled Rule'}</strong>
      </div>

      {d.pathFilter && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
          Path: <code style={{ background: '#334155', padding: '1px 4px', borderRadius: 3 }}>{d.pathFilter}</code>
        </div>
      )}

      <div style={{ fontSize: 11, color: '#94a3b8', maxHeight: 60, overflow: 'hidden' }}>
        {d.content ? d.content.substring(0, 100) + (d.content.length > 100 ? '...' : '') : 'No content yet'}
      </div>
    </div>
  );
}
