import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import { useStore } from '../state/store';
import { ResistorNode, VoltageSourceNode, CurrentSourceNode, GroundNode } from './CircuitNodes';
import '@xyflow/react/dist/style.css';
import './SchematicCanvas.css';

const nodeTypes: NodeTypes = {
  resistor: ResistorNode,
  voltage_source: VoltageSourceNode,
  current_source: CurrentSourceNode,
  ground: GroundNode,
};

export function SchematicCanvas() {
  const getActiveRun = useStore((s) => s.getActiveRun);

  const run = getActiveRun();

  const { nodes, edges } = useMemo(() => {
    if (!run || run.mode !== 'circuit') {
      return { nodes: [], edges: [] };
    }

    // For now, show placeholder
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    return { nodes, edges };
  }, [run]);

  return (
    <div className="schematic-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a3a5c" />
      </ReactFlow>
    </div>
  );
}
