import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
} from '@xyflow/react';
import { useStore } from '../state/store';
import { ResistorNode, VoltageSourceNode, CurrentSourceNode, GroundNode, WireNode } from './CircuitNodes';
import '@xyflow/react/dist/style.css';
import './SchematicCanvas.css';

const nodeTypes: NodeTypes = {
  resistor: ResistorNode,
  voltage_source: VoltageSourceNode,
  current_source: CurrentSourceNode,
  ground: GroundNode,
  wire: WireNode,
};

export function SchematicCanvas() {
  const getActiveRun = useStore((s) => s.getActiveRun);

  const run = getActiveRun();
  const circuitConfig = run?.circuitConfig;
  const circuitResult = run?.circuitResult;

  const { nodes, edges } = useMemo(() => {
    if (!circuitConfig) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Build node voltage map for display
    const voltageMap = new Map<number, number>();
    if (circuitResult?.success && circuitResult.nodeVoltages) {
      circuitResult.nodeVoltages.forEach((v, i) => {
        voltageMap.set(i, v);
      });
    }

    // Build current map
    const currentMap = new Map<string, number>();
    if (circuitResult?.success && circuitResult.branchCurrents) {
      for (const bc of circuitResult.branchCurrents) {
        currentMap.set(bc.id, bc.current);
      }
    }

    for (const comp of circuitConfig.components) {
      const current = currentMap.get(comp.id);
      const voltageA = voltageMap.get(comp.nodeA);
      const voltageB = voltageMap.get(comp.nodeB);

      let label = '';
      let resultLabel = '';
      switch (comp.type) {
        case 'resistor':
          label = `${comp.id}: ${formatValue(comp.value, 'Ω')}`;
          if (current !== undefined) {
            resultLabel = `I = ${formatValue(Math.abs(current), 'A')}`;
            if (voltageA !== undefined && voltageB !== undefined) {
              resultLabel += ` | ΔV = ${(voltageA - voltageB).toFixed(2)}V`;
            }
          }
          break;
        case 'voltage_source':
          label = `${comp.id}: ${comp.value}V`;
          if (current !== undefined) {
            resultLabel = `I = ${formatValue(Math.abs(current), 'A')}`;
          }
          break;
        case 'current_source':
          label = `${comp.id}: ${formatValue(comp.value, 'A')}`;
          break;
        case 'wire':
          label = comp.id;
          break;
        case 'ground':
          label = 'GND';
          break;
      }

      // Add node voltage labels
      let nodeLabel = '';
      if (voltageA !== undefined && comp.type !== 'ground') {
        nodeLabel = `N${comp.nodeA}=${voltageA.toFixed(2)}V`;
        if (voltageB !== undefined) {
          nodeLabel += ` → N${comp.nodeB}=${voltageB.toFixed(2)}V`;
        }
      }

      nodes.push({
        id: comp.id,
        type: comp.type,
        position: { x: comp.x, y: comp.y },
        data: {
          label,
          resultLabel,
          nodeLabel,
          value: comp.value,
          hasResult: circuitResult?.success ?? false,
        },
      });

      // Create edges for connections
      if (comp.type !== 'ground') {
        // We show connectivity via node labels rather than edges for now
        // since components embed their own terminal info
      }
    }

    // Build edges between components that share nodes
    const nodeToComponents = new Map<number, string[]>();
    for (const comp of circuitConfig.components) {
      const aList = nodeToComponents.get(comp.nodeA) ?? [];
      aList.push(comp.id);
      nodeToComponents.set(comp.nodeA, aList);
      if (comp.type !== 'ground') {
        const bList = nodeToComponents.get(comp.nodeB) ?? [];
        bList.push(comp.id);
        nodeToComponents.set(comp.nodeB, bList);
      }
    }

    for (const [node, compIds] of nodeToComponents) {
      for (let i = 0; i < compIds.length; i++) {
        for (let j = i + 1; j < compIds.length; j++) {
          edges.push({
            id: `e-${node}-${compIds[i]}-${compIds[j]}`,
            source: compIds[i],
            target: compIds[j],
            label: `N${node}`,
            style: { stroke: '#4fc3f7', strokeWidth: 1.5 },
            labelStyle: { fill: '#a0a8b8', fontSize: 9 },
          });
        }
      }
    }

    return { nodes, edges };
  }, [circuitConfig, circuitResult]);

  if (!circuitConfig) {
    return (
      <div className="schematic-canvas schematic-empty">
        <p>No circuit loaded. Select a demo circuit from the palette.</p>
      </div>
    );
  }

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
        <Controls />
        <MiniMap
          style={{ background: '#1a1a2e' }}
          nodeColor="#4fc3f7"
          maskColor="rgba(0,0,0,0.5)"
        />
      </ReactFlow>
    </div>
  );
}

function formatValue(value: number, unit: string): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M${unit}`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k${unit}`;
  if (value >= 1) return `${value.toFixed(1)}${unit}`;
  if (value >= 1e-3) return `${(value * 1e3).toFixed(1)}m${unit}`;
  if (value >= 1e-6) return `${(value * 1e6).toFixed(1)}μ${unit}`;
  return `${value.toExponential(2)}${unit}`;
}
