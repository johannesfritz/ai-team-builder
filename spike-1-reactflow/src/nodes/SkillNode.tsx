import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SkillData } from '../types';
import { NODE_COLORS } from '../types';

export function SkillNode({ data, selected }: NodeProps) {
  const d = data as unknown as SkillData;
  return (
    <div style={{
      border: `2px solid ${selected ? '#fff' : NODE_COLORS.skill}`,
      borderRadius: 8,
      background: '#1e293b',
      padding: 12,
      minWidth: 220,
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 13,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: NODE_COLORS.skill }} />
      <Handle type="source" position={Position.Right} style={{ background: NODE_COLORS.skill }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ background: NODE_COLORS.skill, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 600, color: '#fff' }}>SKILL</span>
        <strong>{d.name || 'Untitled Skill'}</strong>
      </div>

      {d.description && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{d.description}</div>
      )}

      {d.filePattern && (
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          Files: <code style={{ background: '#334155', padding: '1px 4px', borderRadius: 3 }}>{d.filePattern}</code>
        </div>
      )}
    </div>
  );
}
