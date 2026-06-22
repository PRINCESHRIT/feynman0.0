import { useStore } from '../state/store';
import type { EditorTool } from '../types/simulation';
import './Palette.css';

interface PaletteItem {
  tool: EditorTool;
  label: string;
  color: string;
  symbol: string;
}

const fieldItems: PaletteItem[] = [
  { tool: 'select', label: 'Select', color: 'var(--text-secondary)', symbol: '↖' },
  { tool: 'place_positive', label: 'Positive Charge', color: '#ef5350', symbol: '+' },
  { tool: 'place_negative', label: 'Negative Charge', color: '#42a5f5', symbol: '−' },
];

const circuitItems: PaletteItem[] = [
  { tool: 'select', label: 'Select', color: 'var(--text-secondary)', symbol: '↖' },
  { tool: 'place_resistor', label: 'Resistor', color: '#e8e8e8', symbol: '⏛' },
  { tool: 'place_vsource', label: 'Voltage Source', color: '#ef5350', symbol: 'V' },
  { tool: 'place_isource', label: 'Current Source', color: '#ffa726', symbol: 'I' },
  { tool: 'place_ground', label: 'Ground', color: '#66bb6a', symbol: '⏚' },
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
        {items.map((item) => (
          <button
            key={item.tool}
            className={`palette-item ${activeTool === item.tool ? 'active' : ''}`}
            onClick={() => setActiveTool(item.tool)}
          >
            <span className="palette-icon" style={{ color: item.color }}>
              {item.symbol}
            </span>
            <span className="palette-label">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
