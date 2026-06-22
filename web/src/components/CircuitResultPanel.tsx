import { useStore } from '../state/store';
import './CircuitResultPanel.css';

export function CircuitResultPanel() {
  const getActiveRun = useStore((s) => s.getActiveRun);
  const run = getActiveRun();
  const result = run?.circuitResult;
  const config = run?.circuitConfig;

  if (!config) {
    return (
      <div className="circuit-result-panel">
        <div className="circuit-result-header">Circuit Results</div>
        <div className="circuit-result-empty">No circuit loaded</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="circuit-result-panel">
        <div className="circuit-result-header">Circuit Results</div>
        <div className="circuit-result-empty">Press Solve to analyze circuit</div>
      </div>
    );
  }

  if (!result.success) {
    return (
      <div className="circuit-result-panel">
        <div className="circuit-result-header">Circuit Results</div>
        <div className="circuit-result-error">{result.error ?? 'Solve failed'}</div>
      </div>
    );
  }

  // Collect unique nodes from components
  const nodeSet = new Set<number>();
  for (const comp of config.components) {
    nodeSet.add(comp.nodeA);
    nodeSet.add(comp.nodeB);
  }
  const nodes = Array.from(nodeSet).sort((a, b) => a - b);

  return (
    <div className="circuit-result-panel">
      <div className="circuit-result-header">Circuit Results</div>

      <div className="circuit-result-section">
        <div className="circuit-result-section-title">Node Voltages</div>
        <table className="circuit-result-table">
          <thead>
            <tr>
              <th>Node</th>
              <th>Voltage</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n}>
                <td>N{n}</td>
                <td>{formatValue(result.nodeVoltages[n] ?? 0, 'V')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="circuit-result-section">
        <div className="circuit-result-section-title">Branch Currents</div>
        <table className="circuit-result-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Current</th>
            </tr>
          </thead>
          <tbody>
            {result.branchCurrents.map((bc) => {
              const comp = config.components.find((c) => c.id === bc.id);
              const label = comp ? `${comp.type} (${comp.id.slice(0, 4)})` : bc.id;
              return (
                <tr key={bc.id}>
                  <td>{label}</td>
                  <td>{formatValue(bc.current, 'A')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatValue(val: number, unit: string): string {
  const abs = Math.abs(val);
  if (abs === 0) return `0 ${unit}`;
  if (abs >= 1e6) return `${(val / 1e6).toFixed(2)} M${unit}`;
  if (abs >= 1e3) return `${(val / 1e3).toFixed(2)} k${unit}`;
  if (abs >= 1) return `${val.toFixed(3)} ${unit}`;
  if (abs >= 1e-3) return `${(val * 1e3).toFixed(2)} m${unit}`;
  if (abs >= 1e-6) return `${(val * 1e6).toFixed(2)} μ${unit}`;
  return `${val.toExponential(2)} ${unit}`;
}
