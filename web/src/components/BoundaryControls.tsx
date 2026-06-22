import { useStore } from '../state/store';
import type { BoundaryCondition } from '../types/simulation';
import './BoundaryControls.css';

export function BoundaryControls() {
  const getActiveRun = useStore((s) => s.getActiveRun);
  const forkRun = useStore((s) => s.forkRun);

  const run = getActiveRun();
  if (!run) return null;

  const bc = run.config.boundary;

  const handleTypeChange = (type: BoundaryCondition['type']) => {
    let boundary: BoundaryCondition;
    if (type === 'dirichlet_zero') {
      boundary = { type: 'dirichlet_zero' };
    } else if (type === 'dirichlet_fixed') {
      boundary = { type: 'dirichlet_fixed', voltages: [0, 0, 0, 0] };
    } else {
      boundary = { type: 'neumann' };
    }
    forkRun(run.id, { boundary });
  };

  const handleVoltageChange = (edge: number, value: number) => {
    if (bc.type !== 'dirichlet_fixed') return;
    const voltages = [...bc.voltages] as [number, number, number, number];
    voltages[edge] = value;
    forkRun(run.id, { boundary: { type: 'dirichlet_fixed', voltages } });
  };

  return (
    <div className="boundary-controls">
      <div className="boundary-header">Boundary Conditions</div>
      <div className="boundary-fields">
        <select
          value={bc.type}
          onChange={(e) => handleTypeChange(e.target.value as BoundaryCondition['type'])}
          className="boundary-select"
        >
          <option value="dirichlet_zero">Dirichlet (V=0)</option>
          <option value="dirichlet_fixed">Dirichlet (Fixed)</option>
          <option value="neumann">Neumann (dV/dn=0)</option>
        </select>

        {bc.type === 'dirichlet_fixed' && (
          <div className="boundary-voltages">
            {(['Top', 'Right', 'Bottom', 'Left'] as const).map((label, i) => (
              <label key={label} className="boundary-voltage-row">
                <span>{label}</span>
                <input
                  type="number"
                  step="0.1"
                  value={bc.voltages[i]}
                  onChange={(e) => handleVoltageChange(i, Number(e.target.value))}
                  className="boundary-input"
                />
                <span className="boundary-unit">V</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
