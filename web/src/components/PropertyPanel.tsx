import { useStore } from '../state/store';
import './PropertyPanel.css';

export function PropertyPanel() {
  const selectedIds = useStore((s) => s.selectedIds);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const forkRun = useStore((s) => s.forkRun);
  const clearSelection = useStore((s) => s.clearSelection);

  const run = getActiveRun();
  if (!run || selectedIds.size === 0) return null;

  // Single selection: show full property editor
  if (selectedIds.size === 1) {
    const selectedId = selectedIds.values().next().value!;
    const charge = run.config.charges.find((c) => c.id === selectedId);
    if (!charge) return null;

    const updateCharge = (changes: Partial<{ x: number; y: number; q: number }>) => {
      // F3.1 error handling: reject NaN
      for (const val of Object.values(changes)) {
        if (typeof val === 'number' && !Number.isFinite(val)) return;
      }
      const newCharges = run.config.charges.map((c) =>
        c.id === selectedId ? { ...c, ...changes } : c
      );
      forkRun(run.id, { charges: newCharges });
    };

    const deleteCharge = () => {
      const newCharges = run.config.charges.filter((c) => c.id !== selectedId);
      forkRun(run.id, { charges: newCharges });
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

  // Multi-selection: show count + bulk delete
  const deleteSelected = () => {
    const newCharges = run.config.charges.filter((c) => !selectedIds.has(c.id));
    forkRun(run.id, { charges: newCharges });
    clearSelection();
  };

  return (
    <div className="property-panel">
      <div className="property-header">Selection</div>
      <div className="property-fields">
        <div className="property-row">
          <span>{selectedIds.size} charges selected</span>
        </div>
        <button className="delete-btn" onClick={deleteSelected}>
          Delete Selected ({selectedIds.size})
        </button>
      </div>
    </div>
  );
}
