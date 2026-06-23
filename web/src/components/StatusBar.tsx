import { useStore } from '../state/store';
import './StatusBar.css';

export function StatusBar() {
  const solverStatus = useStore((s) => s.solverStatus);
  const solverProgress = useStore((s) => s.solverProgress);
  const solveResult = useStore((s) => s.solveResult);
  const resolution = useStore((s) => s.resolution);
  const inlineFallback = useStore((s) => s.inlineFallback);
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
        {solverStatus === 'solving' && solverProgress && (
          <>Solving... {solverProgress.iterations} iter (residual: {solverProgress.residual.toExponential(2)})</>
        )}
        {solverStatus === 'solving' && !solverProgress && 'Initializing...'}
        {solverStatus === 'converged' && solveResult && (
          <>Converged ✓ {solveResult.iterations} iter ({solveResult.timeMs.toFixed(0)}ms)</>
        )}
        {solverStatus === 'failed' && solveResult && (
          <>Not converged ⚠ {solveResult.iterations} iter (residual: {solveResult.residual.toExponential(2)})</>
        )}
        {solverStatus === 'idle' && 'Ready'}
        {solverStatus === 'cancelled' && 'Cancelled'}
      </span>
      {solverStatus === 'solving' && solverProgress && (
        <span className="status-item residual-bar">
          <div
            className="residual-fill"
            style={{
              width: `${Math.max(0, Math.min(100, 100 * (1 + Math.log10(Math.max(solverProgress.residual, 1e-10)) / 10)))}%`,
            }}
          />
        </span>
      )}
      {inlineFallback && (
        <span className="status-item status-warn">⚠ Reduced performance mode</span>
      )}
      <span className="status-item status-right">
        {resolution}×{resolution}
      </span>
    </div>
  );
}
