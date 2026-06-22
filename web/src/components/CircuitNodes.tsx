import { Handle, Position, type NodeProps } from '@xyflow/react';
import './CircuitNodes.css';

interface CircuitNodeData {
  label: string;
  resultLabel?: string;
  nodeLabel?: string;
  value?: number;
  hasResult?: boolean;
}

function getData(props: NodeProps): CircuitNodeData {
  return props.data as unknown as CircuitNodeData;
}

export function ResistorNode(props: NodeProps) {
  const d = getData(props);
  return (
    <div className="circuit-node resistor-node">
      <Handle type="target" position={Position.Left} />
      <svg width="80" height="28" viewBox="0 0 80 28">
        <polyline
          points="0,14 10,14 14,4 22,24 30,4 38,24 46,4 54,24 58,14 80,14"
          fill="none"
          stroke="#e8e8e8"
          strokeWidth="2"
        />
      </svg>
      <div className="circuit-label">{d.label}</div>
      {d.hasResult && d.resultLabel && (
        <div className="circuit-result">{d.resultLabel}</div>
      )}
      {d.hasResult && d.nodeLabel && (
        <div className="circuit-nodes-label">{d.nodeLabel}</div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function VoltageSourceNode(props: NodeProps) {
  const d = getData(props);
  return (
    <div className="circuit-node vsource-node">
      <Handle type="target" position={Position.Left} />
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="#e8e8e8" strokeWidth="2" />
        <line x1="4" y1="24" x2="14" y2="24" stroke="#e8e8e8" strokeWidth="2" />
        <line x1="34" y1="24" x2="44" y2="24" stroke="#e8e8e8" strokeWidth="2" />
        <text x="18" y="20" fill="#ef5350" fontSize="14" fontWeight="bold">+</text>
        <text x="26" y="34" fill="#42a5f5" fontSize="14" fontWeight="bold">−</text>
      </svg>
      <div className="circuit-label">{d.label}</div>
      {d.hasResult && d.resultLabel && (
        <div className="circuit-result">{d.resultLabel}</div>
      )}
      {d.hasResult && d.nodeLabel && (
        <div className="circuit-nodes-label">{d.nodeLabel}</div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function CurrentSourceNode(props: NodeProps) {
  const d = getData(props);
  return (
    <div className="circuit-node isource-node">
      <Handle type="target" position={Position.Left} />
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="#e8e8e8" strokeWidth="2" />
        <line x1="24" y1="10" x2="24" y2="38" stroke="#e8e8e8" strokeWidth="2" />
        <polygon points="24,10 20,18 28,18" fill="#e8e8e8" />
      </svg>
      <div className="circuit-label">{d.label}</div>
      {d.hasResult && d.nodeLabel && (
        <div className="circuit-nodes-label">{d.nodeLabel}</div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function GroundNode(props: NodeProps) {
  const d = getData(props);
  return (
    <div className="circuit-node ground-node">
      <Handle type="target" position={Position.Top} />
      <svg width="36" height="28" viewBox="0 0 36 28">
        <line x1="18" y1="0" x2="18" y2="8" stroke="#e8e8e8" strokeWidth="2" />
        <line x1="6" y1="8" x2="30" y2="8" stroke="#e8e8e8" strokeWidth="2" />
        <line x1="10" y1="14" x2="26" y2="14" stroke="#e8e8e8" strokeWidth="2" />
        <line x1="14" y1="20" x2="22" y2="20" stroke="#e8e8e8" strokeWidth="2" />
      </svg>
      <div className="circuit-label">{d.label}</div>
    </div>
  );
}

export function WireNode(props: NodeProps) {
  const d = getData(props);
  return (
    <div className="circuit-node wire-node">
      <Handle type="target" position={Position.Left} />
      <svg width="60" height="8" viewBox="0 0 60 8">
        <line x1="0" y1="4" x2="60" y2="4" stroke="#4fc3f7" strokeWidth="2" />
      </svg>
      <div className="circuit-label">{d.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
