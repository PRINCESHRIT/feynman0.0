import { useStore } from '../state/store';
import './PropertyPanel.css';

export function PropertyPanel() {
  const selectedId = useStore((s) => s.selectedId);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const forkRun = useStore((s) => s.forkRun);
  const setSelectedId = useStore((s) => s.setSelectedId);

  const run = getActiveRun();
  if (!run || !selectedId) return null;

  const charge = run.config.charges.find((c) => c.id === selectedId);
  if (!charge) return null;

  const updateCharge = (changes: Partial<{ x: number; y: number; q: number }>) => {
    const newCharges = run.config.charges.map((c) =>
      c.id === selectedId ? { ...c, ...changes } : c
    );
    forkRun(run.id, { charges: newCharges });
  };

  const deleteCharge = () => {
    const newCharges = run.config.charges.filter((c) => c.id !== selectedId);
    forkRun(run.id, { charges: newCharges });
    setSelectedId(null);
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
            onChange={(e) => updateCharge({ x: Number(e.target.value) })}
            className="property-input"
          />
        </label>
        <label className="property-row">
          <span>Y</span>
          <input
            type="number"
            value={charge.y}
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
