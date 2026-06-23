import { useStore } from '../state/store';
import type { EditorTool } from '../types/simulation';
import './Palette.css';

interface PaletteItem {
  tool: EditorTool;
  label: string;
  color: string;
  symbol: string;
  disabled?: boolean;
  disabledNote?: string;
}

const fieldItems: PaletteItem[] = [
  { tool: 'select', label: 'Select', color: 'var(--text-secondary)', symbol: '↖' },
  { tool: 'place_positive', label: 'Positive Charge', color: '#ef5350', symbol: '+' },
  { tool: 'place_negative', label: 'Negative Charge', color: '#42a5f5', symbol: '−' },
  // F4.1: Conductor support (places a fixed-voltage conductor cell)
  { tool: 'place_conductor', label: 'Conductor', color: '#ffa726', symbol: '█' },
  // v2 placeholder: disabled, sets expectations
  { tool: 'select', label: 'Dielectric', color: '#666', symbol: 'ε', disabled: true, disabledNote: 'v2' },
];

const circuitItems: PaletteItem[] = [
  { tool: 'select', label: 'Select', color: 'var(--text-secondary)', symbol: '↖' },
  { tool: 'place_resistor', label: 'Resistor', color: '#e8e8e8', symbol: '⏛' },
  { tool: 'place_vsource', label: 'Voltage Source', color: '#ef5350', symbol: 'V' },
  { tool: 'place_isource', label: 'Current Source', color: '#ffa726', symbol: 'I' },
  { tool: 'place_wire', label: 'Wire', color: '#4fc3f7', symbol: '─' },
  { tool: 'place_ground', label: 'Ground', color: '#66bb6a', symbol: '⏚' },
  // v2 placeholders
  { tool: 'select', label: 'Capacitor', color: '#666', symbol: 'C', disabled: true, disabledNote: 'v2 — needs transient' },
  { tool: 'select', label: 'Inductor', color: '#666', symbol: 'L', disabled: true, disabledNote: 'v2 — needs transient' },
];

export function Palette() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const mode = useStore((s) => s.mode);

  const items = mode === 'field' ? fieldItems : circuitItems;

  return (
    <div className="palette">
      <div className="palette-header">Components</div>
      <div className="palette-items">
        {items.map((item, i) => (
          <button
            key={`${item.tool}-${i}`}
            className={`palette-item ${activeTool === item.tool && !item.disabled ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
            onClick={() => !item.disabled && setActiveTool(item.tool)}
            disabled={item.disabled}
            title={item.disabledNote}
          >
            <span className="palette-icon" style={{ color: item.disabled ? '#444' : item.color }}>
              {item.symbol}
            </span>
            <span className="palette-label">
              {item.label}
              {item.disabledNote && <span className="palette-note">{item.disabledNote}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
