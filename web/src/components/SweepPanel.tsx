/**
 * SweepPanel — Phase 8: Parametric Sweep UI.
 *
 * Pick a parameter + range → generate N runs in the background.
 * Editor stays fully interactive during sweep.
 */

import { useState, useCallback } from 'react';
import { useStore } from '../state/store';
import { runSweep, type SweepConfig, type SweepResult, type SweepParameter } from '../solver/sweepEngine';
import './SweepPanel.css';

export function SweepPanel() {
  const getActiveRun = useStore((s) => s.getActiveRun);
  const selectedIds = useStore((s) => s.selectedIds);
  const mode = useStore((s) => s.mode);

  const [sweepActive, setSweepActive] = useState(false);
  const [sweepResult, setSweepResult] = useState<SweepResult | null>(null);
  const [paramType, setParamType] = useState<'charge_q' | 'charge_x' | 'resolution'>('charge_q');
  const [start, setStart] = useState(-3);
  const [end, setEnd] = useState(3);
  const [steps, setSteps] = useState(10);

  const run = getActiveRun();
  if (!run || mode !== 'field') return null;

  const selectedId = selectedIds.size === 1 ? selectedIds.values().next().value! : null;
  const charge = selectedId ? run.config.charges.find((c) => c.id === selectedId) : null;

  const handleStartSweep = useCallback(async () => {
    if (!run) return;

    let parameter: SweepParameter;
    if (paramType === 'resolution') {
      parameter = { type: 'resolution', label: 'Resolution' };
    } else if (!charge) {
      return;
    } else {
      parameter = { type: paramType, chargeId: charge.id, label: `${charge.id.slice(0, 4)} ${paramType.split('_')[1]}` };
    }

    const config: SweepConfig = { parameter, start, end, steps };
    setSweepActive(true);
    setSweepResult(null);

    const result = await runSweep(run.config, config, (progress) => {
      setSweepResult({ ...progress });
    });

    setSweepResult(result);
    setSweepActive(false);
  }, [run, charge, paramType, start, end, steps]);

  return (
    <div className="sweep-panel">
      <div className="sweep-header">Parametric Sweep</div>

      <div className="sweep-fields">
        <label className="sweep-row">
          <span>Parameter</span>
          <select
            value={paramType}
            onChange={(e) => setParamType(e.target.value as any)}
            className="sweep-select"
          >
            {charge && <option value="charge_q">Charge Q</option>}
            {charge && <option value="charge_x">Charge X</option>}
            <option value="resolution">Resolution</option>
          </select>
        </label>

        <label className="sweep-row">
          <span>Start</span>
          <input
            type="number"
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            className="sweep-input"
          />
        </label>

        <label className="sweep-row">
          <span>End</span>
          <input
            type="number"
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
            className="sweep-input"
          />
        </label>

        <label className="sweep-row">
          <span>Steps</span>
          <input
            type="number"
            min={2}
            max={50}
            value={steps}
            onChange={(e) => setSteps(Math.max(2, Math.min(50, Number(e.target.value))))}
            className="sweep-input"
          />
        </label>

        <button
          className="sweep-btn"
          onClick={handleStartSweep}
          disabled={sweepActive || (paramType !== 'resolution' && !charge)}
        >
          {sweepActive ? 'Running...' : `Run Sweep (${steps} points)`}
        </button>
      </div>

      {/* F8.2: Result series view */}
      {sweepResult && (
        <div className="sweep-results">
          <div className="sweep-results-header">
            {sweepResult.completed}/{sweepResult.total} complete
            {sweepResult.failed > 0 && (
              <span className="sweep-failed"> ({sweepResult.failed} failed)</span>
            )}
          </div>

          <div className="sweep-progress-bar">
            <div
              className="sweep-progress-fill"
              style={{ width: `${(sweepResult.completed / sweepResult.total) * 100}%` }}
            />
          </div>

          {!sweepActive && (
            <div className="sweep-series">
              {sweepResult.results.map((r, i) => (
                <div
                  key={i}
                  className={`sweep-series-item ${r.converged ? 'converged' : 'failed'}`}
                  title={`Value: ${sweepResult.values[i].toFixed(2)}, ${r.converged ? 'Converged' : 'Failed'} (${r.iterations} iter, ${r.timeMs.toFixed(0)}ms)`}
                >
                  <span className="sweep-dot">{r.converged ? '✓' : '✗'}</span>
                  <span className="sweep-val">{sweepResult.values[i].toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!charge && paramType !== 'resolution' && (
        <div className="sweep-hint">Select a charge to sweep its parameters</div>
      )}
    </div>
  );
}
