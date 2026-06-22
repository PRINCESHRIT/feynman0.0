import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type OnNodeClick,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { useStore } from '../state/store';
import { RunTreeNode } from './RunTreeNode';
import '@xyflow/react/dist/style.css';
import './RunTreePanel.css';

const nodeTypes: NodeTypes = {
  runNode: RunTreeNode,
};

const NODE_WIDTH = 160;
const NODE_HEIGHT = 48;

export function RunTreePanel() {
  const runs = useStore((s) => s.runs);
  const activeRunId = useStore((s) => s.activeRunId);
  const setActiveRun = useStore((s) => s.setActiveRun);

  const { nodes, edges } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', ranksep: 30, nodesep: 20 });

    const runList = Array.from(runs.values());

    // Add nodes
    for (const run of runList) {
      g.setNode(run.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    // Add edges
    const edges: Edge[] = [];
    for (const run of runList) {
      if (run.parentId && runs.has(run.parentId)) {
        g.setEdge(run.parentId, run.id);
        edges.push({
          id: `${run.parentId}-${run.id}`,
          source: run.parentId,
          target: run.id,
          style: { stroke: '#4fc3f7', strokeWidth: 1.5 },
        });
      }
    }

    dagre.layout(g);

    const nodes: Node[] = runList.map((run) => {
      const pos = g.node(run.id);
      return {
        id: run.id,
        type: 'runNode',
        position: { x: (pos?.x ?? 0) - NODE_WIDTH / 2, y: (pos?.y ?? 0) - NODE_HEIGHT / 2 },
        data: {
          label: run.label,
          status: run.result
            ? run.result.converged ? 'converged' : 'failed'
            : 'pending',
          chargeCount: run.config.charges.length,
          isActive: run.id === activeRunId,
        },
      };
    });

    return { nodes, edges };
  }, [runs, activeRunId]);

  const onNodeClick: OnNodeClick = useCallback((_event, node) => {
    setActiveRun(node.id);
  }, [setActiveRun]);

  return (
    <div className="run-tree-panel">
      <div className="run-tree-header">Run Tree</div>
      <div className="run-tree-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={0.5} color="#2a3a5c" />
        </ReactFlow>
      </div>
    </div>
  );
}
