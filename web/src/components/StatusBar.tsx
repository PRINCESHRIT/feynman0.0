import { useStore } from '../state/store';
import './StatusBar.css';

export function StatusBar() {
  const solverStatus = useStore((s) => s.solverStatus);
  const solveResult = useStore((s) => s.solveResult);
  const resolution = useStore((s) => s.resolution);
  const getActiveRun = useStore((s) => s.getActiveRun);

  const run = getActiveRun();
  const engine = run?.config.engine ?? 'gauss_seidel';

  const engineLabel: Record<string, string> = {
    jacobi: 'Jacobi',
    gauss_seidel: 'Gauss-Seidel',
    sor: 'SOR',
  };

  return (
    <div className="status-bar">
      <span className="status-item">
        Engine: {engineLabel[engine] ?? engine}
      </span>
      <span className="status-item">
        {solverStatus === 'solving' && 'Solving...'}
        {solverStatus === 'converged' && solveResult && (
          <>Converged ✓ {solveResult.iterations} iter ({solveResult.timeMs.toFixed(0)}ms)</>
        )}
        {solverStatus === 'failed' && solveResult && (
          <>Not converged ⚠ {solveResult.iterations} iter (residual: {solveResult.residual.toExponential(2)})</>
        )}
        {solverStatus === 'idle' && 'Ready'}
        {solverStatus === 'cancelled' && 'Cancelled'}
      </span>
      <span className="status-item">
        {resolution}×{resolution}
      </span>
    </div>
  );
}
