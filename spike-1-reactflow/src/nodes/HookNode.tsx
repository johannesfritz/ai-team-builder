import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { HookData } from '../types';
import { NODE_COLORS } from '../types';

export function HookNode({ data, selected }: NodeProps) {
  const d = data as unknown as HookData;
  return (
    <div style={{
      border: `2px solid ${selected ? '#fff' : NODE_COLORS.hook}`,
      borderRadius: 8,
      background: '#1e293b',
      padding: 12,
      minWidth: 240,
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 13,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: NODE_COLORS.hook }} />
      <Handle type="source" position={Position.Right} style={{ background: NODE_COLORS.hook }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ background: NODE_COLORS.hook, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 600, color: '#fff' }}>HOOK</span>
        <strong>{d.event || 'PreToolUse'}</strong>
      </div>

      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
        Matcher: <code style={{ background: '#334155', padding: '1px 4px', borderRadius: 3 }}>{d.matcher || '*'}</code>
      </div>

      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
        Action: <code style={{ background: '#334155', padding: '1px 4px', borderRadius: 3 }}>{d.action || 'cat ...'}</code>
      </div>

      {d.once && (
        <div style={{ fontSize: 10, color: '#f97316' }}>once per session</div>
      )}
    </div>
  );
}
