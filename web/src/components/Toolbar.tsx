import { useStore } from '../state/store';
import { solveGaussSeidel } from '../solver/gaussSeidel';
import './Toolbar.css';

export function Toolbar() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const solverStatus = useStore((s) => s.solverStatus);
  const setSolverStatus = useStore((s) => s.setSolverStatus);
  const setSolveResult = useStore((s) => s.setSolveResult);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const updateResult = useStore((s) => s.updateResult);
  const resolution = useStore((s) => s.resolution);
  const setResolution = useStore((s) => s.setResolution);
  const showEquipotentials = useStore((s) => s.showEquipotentials);
  const toggleEquipotentials = useStore((s) => s.toggleEquipotentials);
  const showVectors = useStore((s) => s.showVectors);
  const toggleVectors = useStore((s) => s.toggleVectors);
  const showGrid = useStore((s) => s.showGrid);
  const toggleGrid = useStore((s) => s.toggleGrid);

  const handleSolve = () => {
    const run = getActiveRun();
    if (!run) return;

    setSolverStatus('solving');

    // Use setTimeout to not block UI
    setTimeout(() => {
      const config = {
        ...run.config,
        grid: { width: resolution, height: resolution },
      };
      const result = solveGaussSeidel(config);
      setSolveResult(result);
      updateResult(run.id, result);
      setSolverStatus(result.converged ? 'converged' : 'failed');
    }, 0);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${mode === 'field' ? 'active' : ''}`}
          onClick={() => setMode('field')}
        >
          Field
        </button>
        <button
          className={`toolbar-btn ${mode === 'circuit' ? 'active' : ''}`}
          onClick={() => setMode('circuit')}
          disabled
          title="Coming in Phase 8"
        >
          Circuit
        </button>
      </div>

      <div className="toolbar-divider" />

      <button
        className="toolbar-btn solve-btn"
        onClick={handleSolve}
        disabled={solverStatus === 'solving'}
      >
        {solverStatus === 'solving' ? 'Solving...' : 'Solve'}
      </button>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <label className="toolbar-label">
          Res:
          <select
            value={resolution}
            onChange={(e) => setResolution(Number(e.target.value))}
            className="toolbar-select"
          >
            <option value={64}>64</option>
            <option value={128}>128</option>
            <option value={256}>256</option>
            <option value={512}>512</option>
          </select>
        </label>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          className={`toolbar-btn toggle ${showEquipotentials ? 'active' : ''}`}
          onClick={toggleEquipotentials}
          title="Toggle equipotential lines"
        >
          Contours
        </button>
        <button
          className={`toolbar-btn toggle ${showVectors ? 'active' : ''}`}
          onClick={toggleVectors}
          title="Toggle field vectors"
        >
          Vectors
        </button>
        <button
          className={`toolbar-btn toggle ${showGrid ? 'active' : ''}`}
          onClick={toggleGrid}
          title="Toggle grid"
        >
          Grid
        </button>
      </div>
    </div>
  );
}
