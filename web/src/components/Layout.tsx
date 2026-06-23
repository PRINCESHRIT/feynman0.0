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
import { LiveControls } from './LiveControls';
import { ConflictList } from './ConflictList';
import { StatusBar } from './StatusBar';
import { ErrorBoundary } from './ErrorBoundary';
import { registerShortcuts, unregisterShortcuts } from '../utils/shortcuts';
import { useStore } from '../state/store';
import { pushCommand, undo, redo } from '../state/commandStack';
import { requestSolve } from '../solver/solveController';
import { generateId } from '../utils/id';
import './Layout.css';

export function Layout() {
  const mode = useStore((s) => s.mode);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const clearSelection = useStore((s) => s.clearSelection);
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const clipboard = useStore((s) => s.clipboard);
  const setClipboard = useStore((s) => s.setClipboard);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const forkRun = useStore((s) => s.forkRun);
  const setActiveRun = useStore((s) => s.setActiveRun);
  const runs = useStore((s) => s.runs);
  const activeRunId = useStore((s) => s.activeRunId);
  const setViewport = useStore((s) => s.setViewport);
  const viewport = useStore((s) => s.viewport);

  /** Apply a config change via the command stack (F2.2). */
  const applyEdit = (description: string, newCharges: typeof getActiveRun extends () => infer R ? R extends { config: { charges: infer C } } ? C : never : never) => {
    const run = getActiveRun();
    if (!run) return;
    const prevConfig = { ...run.config };
    const nextConfig = { ...run.config, charges: newCharges as any };
    pushCommand({ description, prevConfig, nextConfig });
    forkRun(run.id, { charges: newCharges as any });
    requestSolve(nextConfig, 'preview');
  };

  useEffect(() => {
    registerShortcuts([
      {
        key: 'Escape',
        description: 'Deselect',
        action: () => {
          clearSelection();
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

      // F2.1: Delete
      {
        key: 'Delete',
        description: 'Delete selected',
        action: () => {
          if (selectedIds.size === 0) return;
          const run = getActiveRun();
          if (!run) return;
          applyEdit(
            'Delete charges',
            run.config.charges.filter((c) => !selectedIds.has(c.id)),
          );
          clearSelection();
        },
      },
      {
        key: 'Backspace',
        description: 'Delete selected',
        action: () => {
          if (selectedIds.size === 0) return;
          const run = getActiveRun();
          if (!run) return;
          applyEdit(
            'Delete charges',
            run.config.charges.filter((c) => !selectedIds.has(c.id)),
          );
          clearSelection();
        },
      },

      // F2.1: Copy (Ctrl+C)
      {
        key: 'c',
        ctrl: true,
        description: 'Copy',
        action: () => {
          const run = getActiveRun();
          if (!run || selectedIds.size === 0) return;
          const copied = run.config.charges.filter((c) => selectedIds.has(c.id));
          setClipboard(copied);
        },
      },

      // F2.1: Paste (Ctrl+V) — offset by (1,1) to avoid overlap
      {
        key: 'v',
        ctrl: true,
        description: 'Paste',
        action: () => {
          if (clipboard.length === 0) return; // No-op, not an error
          const run = getActiveRun();
          if (!run) return;
          const pasted = clipboard.map((c) => ({
            ...c,
            id: generateId(),
            x: Math.min(c.x + 1, run.config.grid.width - 1),
            y: Math.min(c.y + 1, run.config.grid.height - 1),
          }));
          applyEdit('Paste', [...run.config.charges, ...pasted]);
          setSelectedIds(new Set(pasted.map((c) => c.id)));
        },
      },

      // F2.1: Duplicate (Ctrl+D)
      {
        key: 'd',
        ctrl: true,
        description: 'Duplicate',
        action: () => {
          const run = getActiveRun();
          if (!run || selectedIds.size === 0) return;
          const selected = run.config.charges.filter((c) => selectedIds.has(c.id));
          const duped = selected.map((c) => ({
            ...c,
            id: generateId(),
            x: Math.min(c.x + 1, run.config.grid.width - 1),
            y: Math.min(c.y + 1, run.config.grid.height - 1),
          }));
          applyEdit('Duplicate', [...run.config.charges, ...duped]);
          setSelectedIds(new Set(duped.map((c) => c.id)));
        },
      },

      // F2.2: Undo (Ctrl+Z) — command stack, not run tree
      {
        key: 'z',
        ctrl: true,
        description: 'Undo',
        action: () => {
          const config = undo();
          if (config) {
            const run = getActiveRun();
            if (run) {
              forkRun(run.id, { charges: config.charges });
              requestSolve(config, 'preview');
            }
          }
        },
      },

      // F2.2: Redo (Ctrl+Shift+Z)
      {
        key: 'z',
        ctrl: true,
        shift: true,
        description: 'Redo',
        action: () => {
          const config = redo();
          if (config) {
            const run = getActiveRun();
            if (run) {
              forkRun(run.id, { charges: config.charges });
              requestSolve(config, 'preview');
            }
          }
        },
      },

      // F2.3: Flip vertical (Ctrl+Shift+F)
      {
        key: 'f',
        ctrl: true,
        shift: true,
        description: 'Flip vertical',
        action: () => {
          const run = getActiveRun();
          if (!run || selectedIds.size === 0) return;
          const maxY = run.config.grid.height - 1;
          const flipped = run.config.charges.map((c) =>
            selectedIds.has(c.id) ? { ...c, y: maxY - c.y } : c,
          );
          applyEdit('Flip vertical', flipped);
        },
      },

      // F2.3: Flip horizontal (Ctrl+F)
      {
        key: 'f',
        ctrl: true,
        description: 'Flip horizontal',
        action: () => {
          const run = getActiveRun();
          if (!run || selectedIds.size === 0) return;
          const maxX = run.config.grid.width - 1;
          const flipped = run.config.charges.map((c) =>
            selectedIds.has(c.id) ? { ...c, x: maxX - c.x } : c,
          );
          applyEdit('Flip horizontal', flipped);
        },
      },

      // Zoom
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
              <LiveControls />
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
