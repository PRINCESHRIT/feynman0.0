/**
 * LiveControls — Phase 5: Live Interactive Simulation.
 *
 * F5.1: Dragging a slider continuously updates the solver.
 * F5.3: Live status badge (solving/converged/stale).
 *
 * The slider writes directly to the working config and fires
 * a preview solve. The SolveController handles superseding
 * (latest input wins) and warm-start (F5.2).
 */

import { useCallback, useRef } from 'react';
import { useStore } from '../state/store';
import { requestSolve, clearWarmStart } from '../solver/solveController';
import { pushCommand } from '../state/commandStack';
import './LiveControls.css';

export function LiveControls() {
  const selectedIds = useStore((s) => s.selectedIds);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const forkRun = useStore((s) => s.forkRun);
  const solverStatus = useStore((s) => s.solverStatus);
  const mode = useStore((s) => s.mode);

  // Track the config before slider drag started (for undo)
  const dragStartConfigRef = useRef<any>(null);

  const run = getActiveRun();
  if (!run || mode !== 'field') return null;

  const selectedId = selectedIds.size === 1 ? selectedIds.values().next().value! : null;
  const charge = selectedId ? run.config.charges.find((c) => c.id === selectedId) : null;

  // F5.1: Continuous value manipulation
  const handleSliderStart = () => {
    dragStartConfigRef.current = { ...run.config };
  };

  const handleChargeSlider = useCallback((value: number) => {
    if (!charge || !run) return;
    const newCharges = run.config.charges.map((c) =>
      c.id === charge.id ? { ...c, q: value } : c,
    );
    const newConfig = { ...run.config, charges: newCharges };

    // Optimistic: fork immediately
    forkRun(run.id, { charges: newCharges });

    // F5.2: Preview solve with warm-start (SolveController handles this)
    requestSolve(newConfig, 'preview');
  }, [charge, run, forkRun]);

  const handleSliderEnd = useCallback(() => {
    // Push to command stack for undo
    if (dragStartConfigRef.current && run) {
      pushCommand({
        description: 'Adjust charge value',
        prevConfig: dragStartConfigRef.current,
        nextConfig: { ...run.config },
      });
      dragStartConfigRef.current = null;
    }
  }, [run]);

  // F5.3: Live status badge
  const statusColor = {
    idle: 'var(--text-secondary)',
    solving: '#ffa726',
    converged: 'var(--success)',
    failed: 'var(--error)',
    cancelled: 'var(--text-secondary)',
  }[solverStatus] ?? 'var(--text-secondary)';

  const statusLabel = {
    idle: 'Ready',
    solving: 'Solving...',
    converged: 'Converged',
    failed: 'Not converged',
    cancelled: 'Cancelled',
  }[solverStatus] ?? solverStatus;

  return (
    <div className="live-controls">
      <div className="live-header">
        <span>Live Simulation</span>
        <span className="live-status" style={{ color: statusColor }}>
          ● {statusLabel}
        </span>
      </div>

      {charge && (
        <div className="live-slider-group">
          <label className="live-slider-label">
            Charge Q: {charge.q.toFixed(2)}
          </label>
          <input
            type="range"
            min={-5}
            max={5}
            step={0.05}
            value={charge.q}
            onPointerDown={handleSliderStart}
            onChange={(e) => handleChargeSlider(Number(e.target.value))}
            onPointerUp={handleSliderEnd}
            className="live-slider"
          />
        </div>
      )}

      {!charge && selectedIds.size === 0 && (
        <div className="live-hint">
          Select a charge and drag the slider to see live field updates
        </div>
      )}
    </div>
  );
}
