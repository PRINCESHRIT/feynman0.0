import { Handle, Position, type NodeProps } from '@xyflow/react';

// SVG component symbols for circuit schematic

export function ResistorNode({ data }: NodeProps) {
  return (
    <div className="circuit-node resistor">
      <Handle type="target" position={Position.Left} />
      <svg width="60" height="24" viewBox="0 0 60 24">
        <polyline
          points="0,12 8,12 12,2 20,22 28,2 36,22 44,2 48,12 60,12"
          fill="none"
          stroke="#e8e8e8"
          strokeWidth="2"
        />
      </svg>
      <span className="circuit-label">{(data as any).label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function VoltageSourceNode({ data }: NodeProps) {
  return (
    <div className="circuit-node voltage-source">
      <Handle type="target" position={Position.Left} />
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#e8e8e8" strokeWidth="2" />
        <text x="14" y="18" fill="#ef5350" fontSize="12" fontWeight="bold">+</text>
        <text x="22" y="28" fill="#42a5f5" fontSize="12" fontWeight="bold">−</text>
      </svg>
      <span className="circuit-label">{(data as any).label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function CurrentSourceNode({ data }: NodeProps) {
  return (
    <div className="circuit-node current-source">
      <Handle type="target" position={Position.Left} />
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#e8e8e8" strokeWidth="2" />
        <line x1="20" y1="8" x2="20" y2="32" stroke="#e8e8e8" strokeWidth="2" />
        <polygon points="20,8 16,16 24,16" fill="#e8e8e8" />
      </svg>
      <span className="circuit-label">{(data as any).label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function GroundNode(_props: NodeProps) {
  return (
    <div className="circuit-node ground">
      <Handle type="target" position={Position.Top} />
      <svg width="30" height="24" viewBox="0 0 30 24">
        <line x1="15" y1="0" x2="15" y2="8" stroke="#e8e8e8" strokeWidth="2" />
        <line x1="5" y1="8" x2="25" y2="8" stroke="#e8e8e8" strokeWidth="2" />
        <line x1="8" y1="14" x2="22" y2="14" stroke="#e8e8e8" strokeWidth="2" />
        <line x1="11" y1="20" x2="19" y2="20" stroke="#e8e8e8" strokeWidth="2" />
      </svg>
    </div>
  );
}
