import { useState } from 'react';
import { useStore } from '../state/store';
import { pushCommand } from '../state/commandStack';
import { requestSolve } from '../solver/solveController';
import { alignCharges, distributeCharges, generatePattern, type AlignAxis, type PatternConfig } from '../utils/precision';
import { generateId } from '../utils/id';
import './PropertyPanel.css';

export function PropertyPanel() {
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const forkRun = useStore((s) => s.forkRun);
  const clearSelection = useStore((s) => s.clearSelection);

  const run = getActiveRun();
  if (!run || selectedIds.size === 0) return null;

  const applyEdit = (desc: string, newCharges: typeof run.config.charges) => {
    const prev = { ...run.config };
    const next = { ...run.config, charges: newCharges };
    pushCommand({ description: desc, prevConfig: prev, nextConfig: next });
    forkRun(run.id, { charges: newCharges });
    requestSolve(next, 'preview');
  };

  // ── Single selection: full property editor ──
  if (selectedIds.size === 1) {
    const selectedId = selectedIds.values().next().value!;
    const charge = run.config.charges.find((c) => c.id === selectedId);
    if (!charge) return null;

    const updateCharge = (changes: Partial<{ x: number; y: number; q: number }>) => {
      // F3.1: Reject NaN/Infinity — prior value retained
      for (const val of Object.values(changes)) {
        if (typeof val === 'number' && !Number.isFinite(val)) return;
      }
      // F3.1: Clamp to grid bounds
      if (changes.x !== undefined) changes.x = Math.max(0, Math.min(run.config.grid.width - 1, changes.x));
      if (changes.y !== undefined) changes.y = Math.max(0, Math.min(run.config.grid.height - 1, changes.y));

      const newCharges = run.config.charges.map((c) =>
        c.id === selectedId ? { ...c, ...changes } : c
      );
      applyEdit('Edit charge', newCharges);
    };

    const deleteCharge = () => {
      applyEdit('Delete charge', run.config.charges.filter((c) => c.id !== selectedId));
      clearSelection();
    };

    return (
      <div className="property-panel">
        <div className="property-header">Properties</div>
        <div className="property-fields">
          <label className="property-row">
            <span>X</span>
            <input
              type="number"
              value={charge.x}
              min={0}
              max={run.config.grid.width - 1}
              onChange={(e) => updateCharge({ x: Number(e.target.value) })}
              className="property-input"
            />
          </label>
          <label className="property-row">
            <span>Y</span>
            <input
              type="number"
              value={charge.y}
              min={0}
              max={run.config.grid.height - 1}
              onChange={(e) => updateCharge({ y: Number(e.target.value) })}
              className="property-input"
            />
          </label>
          <label className="property-row">
            <span>Q</span>
            <input
              type="number"
              step="0.1"
              value={charge.q}
              onChange={(e) => updateCharge({ q: Number(e.target.value) })}
              className="property-input"
            />
          </label>
          <button className="delete-btn" onClick={deleteCharge}>
            Delete Charge
          </button>
        </div>
      </div>
    );
  }

  // ── Multi-selection: alignment, distribution, patterns ──
  return (
    <MultiSelectionPanel
      run={run}
      selectedIds={selectedIds}
      setSelectedIds={setSelectedIds}
      clearSelection={clearSelection}
      applyEdit={applyEdit}
    />
  );
}

function MultiSelectionPanel({
  run,
  selectedIds,
  setSelectedIds,
  clearSelection,
  applyEdit,
}: {
  run: NonNullable<ReturnType<ReturnType<typeof useStore.getState>['getActiveRun']>>;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  clearSelection: () => void;
  applyEdit: (desc: string, charges: any) => void;
}) {
  const [patternDx, setPatternDx] = useState(5);
  const [patternDy, setPatternDy] = useState(0);
  const [patternCount, setPatternCount] = useState(4);

  if (!run) return null;

  const handleAlign = (axis: AlignAxis) => {
    const result = alignCharges(run.config.charges, selectedIds, axis);
    applyEdit(`Align ${axis}`, result);
  };

  const handleDistribute = (axis: 'horizontal' | 'vertical') => {
    const result = distributeCharges(run.config.charges, selectedIds, axis);
    applyEdit(`Distribute ${axis}`, result);
  };

  const handlePattern = () => {
    const sources = run.config.charges.filter((c) => selectedIds.has(c.id));
    const config: PatternConfig = { count: patternCount, dx: patternDx, dy: patternDy };
    const newCharges = generatePattern(sources, config, run.config.grid.width, run.config.grid.height);
    if (newCharges.length === 0) return;
    applyEdit('Pattern', [...run.config.charges, ...newCharges]);
    setSelectedIds(new Set(newCharges.map((c) => c.id)));
  };

  const handleDelete = () => {
    applyEdit('Delete selected', run.config.charges.filter((c) => !selectedIds.has(c.id)));
    clearSelection();
  };

  return (
    <div className="property-panel">
      <div className="property-header">Selection ({selectedIds.size})</div>
      <div className="property-fields">
        {/* F3.2: Align */}
        <div className="property-section-label">Align</div>
        <div className="property-btn-row">
          <button className="mini-btn" onClick={() => handleAlign('left')} title="Align left">⇤</button>
          <button className="mini-btn" onClick={() => handleAlign('center-h')} title="Align center H">⇔</button>
          <button className="mini-btn" onClick={() => handleAlign('right')} title="Align right">⇥</button>
          <button className="mini-btn" onClick={() => handleAlign('top')} title="Align top">⤒</button>
          <button className="mini-btn" onClick={() => handleAlign('center-v')} title="Align center V">⇕</button>
          <button className="mini-btn" onClick={() => handleAlign('bottom')} title="Align bottom">⤓</button>
        </div>

        {/* F3.2: Distribute */}
        {selectedIds.size >= 3 && (
          <>
            <div className="property-section-label">Distribute</div>
            <div className="property-btn-row">
              <button className="mini-btn" onClick={() => handleDistribute('horizontal')} title="Distribute H">⬌</button>
              <button className="mini-btn" onClick={() => handleDistribute('vertical')} title="Distribute V">⬍</button>
            </div>
          </>
        )}

        {/* F3.3: Pattern */}
        <div className="property-section-label">Pattern</div>
        <div className="property-pattern-row">
          <label>
            N:
            <input type="number" min={1} max={50} value={patternCount}
              onChange={(e) => setPatternCount(Math.max(1, Math.min(50, Number(e.target.value))))}
              className="property-input mini" />
          </label>
          <label>
            ΔX:
            <input type="number" value={patternDx}
              onChange={(e) => setPatternDx(Number(e.target.value) || 0)}
              className="property-input mini" />
          </label>
          <label>
            ΔY:
            <input type="number" value={patternDy}
              onChange={(e) => setPatternDy(Number(e.target.value) || 0)}
              className="property-input mini" />
          </label>
        </div>
        <button className="action-btn" onClick={handlePattern}>
          Generate Pattern ({patternCount} copies)
        </button>

        <button className="delete-btn" onClick={handleDelete}>
          Delete Selected ({selectedIds.size})
        </button>
      </div>
    </div>
  );
}
