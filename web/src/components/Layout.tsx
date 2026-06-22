import { useEffect } from 'react';
import { Toolbar } from './Toolbar';
import { RunTreePanel } from './RunTreePanel';
import { FieldCanvas } from './FieldCanvas';
import { SchematicCanvas } from './SchematicCanvas';
import { DiffView } from './DiffView';
import { Palette } from './Palette';
import { PropertyPanel } from './PropertyPanel';
import { BoundaryControls } from './BoundaryControls';
import { CircuitResultPanel } from './CircuitResultPanel';
import { ConflictList } from './ConflictList';
import { StatusBar } from './StatusBar';
import { ErrorBoundary } from './ErrorBoundary';
import { registerShortcuts, unregisterShortcuts } from '../utils/shortcuts';
import { useStore } from '../state/store';
import './Layout.css';

export function Layout() {
  const mode = useStore((s) => s.mode);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const selectedId = useStore((s) => s.selectedId);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const forkRun = useStore((s) => s.forkRun);
  const setActiveRun = useStore((s) => s.setActiveRun);
  const runs = useStore((s) => s.runs);
  const activeRunId = useStore((s) => s.activeRunId);
  const setViewport = useStore((s) => s.setViewport);
  const viewport = useStore((s) => s.viewport);

  useEffect(() => {
    registerShortcuts([
      {
        key: 'Escape',
        description: 'Deselect',
        action: () => {
          setSelectedId(null);
          setActiveTool('select');
        },
      },
      {
        key: 's',
        description: 'Select tool',
        action: () => setActiveTool('select'),
      },
      {
        key: 'c',
        description: 'Positive charge tool',
        action: () => setActiveTool('place_positive'),
      },
      {
        key: 'Delete',
        description: 'Delete selected',
        action: () => {
          if (!selectedId) return;
          const run = getActiveRun();
          if (!run) return;
          const newCharges = run.config.charges.filter((c) => c.id !== selectedId);
          forkRun(run.id, { charges: newCharges });
          setSelectedId(null);
        },
      },
      {
        key: 'z',
        ctrl: true,
        description: 'Undo',
        action: () => {
          const run = getActiveRun();
          if (run?.parentId) setActiveRun(run.parentId);
        },
      },
      {
        key: 'z',
        ctrl: true,
        shift: true,
        description: 'Redo',
        action: () => {
          if (!activeRunId) return;
          const children = Array.from(runs.values())
            .filter((r) => r.parentId === activeRunId)
            .sort((a, b) => b.createdAt - a.createdAt);
          if (children.length > 0) setActiveRun(children[0].id);
        },
      },
      {
        key: '=',
        description: 'Zoom in',
        action: () => setViewport({ ...viewport, scale: Math.min(viewport.scale * 1.2, 5) }),
      },
      {
        key: '-',
        description: 'Zoom out',
        action: () => setViewport({ ...viewport, scale: Math.max(viewport.scale / 1.2, 0.2) }),
      },
    ]);
    return () => unregisterShortcuts();
  });

  const isCircuit = mode === 'circuit';

  return (
    <div className="layout">
      <Toolbar />
      <div className="layout-body">
        <ErrorBoundary name="Run Tree">
          <RunTreePanel />
        </ErrorBoundary>
        <div className="layout-canvas">
          <ErrorBoundary name={isCircuit ? 'Schematic' : 'Field Canvas'}>
            {isCircuit ? <SchematicCanvas /> : <FieldCanvas />}
          </ErrorBoundary>
          <DiffView />
        </div>
        <div className="layout-right">
          <Palette />
          {isCircuit ? (
            <CircuitResultPanel />
          ) : (
            <>
              <PropertyPanel />
              <BoundaryControls />
            </>
          )}
          <ConflictList />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
