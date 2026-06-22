import { Handle, Position, type NodeProps } from '@xyflow/react';

interface RunNodeData {
  label: string;
  status: 'converged' | 'failed' | 'pending';
  chargeCount: number;
  isActive: boolean;
}

export function RunTreeNode({ data }: NodeProps) {
  const d = data as unknown as RunNodeData;
  const statusIcon = d.status === 'converged' ? '✓' : d.status === 'failed' ? '⚠' : '○';
  const statusClass = d.status;

  return (
    <div className={`run-tree-node ${statusClass} ${d.isActive ? 'active' : ''}`}>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <span className="run-node-status">{statusIcon}</span>
      <span className="run-node-label">{d.label}</span>
      <span className="run-node-meta">{d.chargeCount}q</span>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
}
