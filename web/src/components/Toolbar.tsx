import { useStore } from '../state/store';
import { solveGaussSeidel } from '../solver/gaussSeidel';
import { solveCircuitMNA } from '../solver/circuitSolver';
import { WorkerManager } from '../solver/workerManager';
import { DEMO_CIRCUITS } from '../solver/demoCircuits';
import type { FieldEngineType } from '../types/simulation';
import './Toolbar.css';

const workerManagerRef = { current: null as WorkerManager | null };

function getWorkerManager(): WorkerManager {
  if (!workerManagerRef.current) {
    workerManagerRef.current = new WorkerManager();
  }
  return workerManagerRef.current;
}

export function Toolbar() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const solverStatus = useStore((s) => s.solverStatus);
  const setSolverStatus = useStore((s) => s.setSolverStatus);
  const setSolverProgress = useStore((s) => s.setSolverProgress);
  const setSolveResult = useStore((s) => s.setSolveResult);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const updateResult = useStore((s) => s.updateResult);
  const updateCircuitResult = useStore((s) => s.updateCircuitResult);
  const forkRun = useStore((s) => s.forkRun);
  const createCircuitRun = useStore((s) => s.createCircuitRun);
  const resolution = useStore((s) => s.resolution);
  const setResolution = useStore((s) => s.setResolution);
  const showEquipotentials = useStore((s) => s.showEquipotentials);
  const toggleEquipotentials = useStore((s) => s.toggleEquipotentials);
  const showVectors = useStore((s) => s.showVectors);
  const toggleVectors = useStore((s) => s.toggleVectors);
  const showGrid = useStore((s) => s.showGrid);
  const toggleGrid = useStore((s) => s.toggleGrid);

  const handleSolveField = async () => {
    const run = getActiveRun();
    if (!run) return;

    setSolverStatus('solving');
    setSolverProgress(null);

    const config = {
      ...run.config,
      grid: { width: resolution, height: resolution },
    };

    try {
      const wm = getWorkerManager();
      const result = await wm.solve(config, {
        mode: 'commit',
        onProgress: (progress) => setSolverProgress(progress),
      });

      if (result) {
        setSolveResult(result);
        updateResult(run.id, result);
        setSolverStatus(result.converged ? 'converged' : 'failed');
      } else {
        setSolverStatus('cancelled');
      }
    } catch {
      // Fallback to TS solver
      setTimeout(() => {
        const result = solveGaussSeidel(config);
        setSolveResult(result);
        updateResult(run.id, result);
        setSolverStatus(result.converged ? 'converged' : 'failed');
      }, 0);
    }
  };

  const handleSolveCircuit = () => {
    const run = getActiveRun();
    if (!run?.circuitConfig) return;

    setSolverStatus('solving');
    const t0 = performance.now();
    const result = solveCircuitMNA(run.circuitConfig);
    const timeMs = performance.now() - t0;

    updateCircuitResult(run.id, result);
    setSolverStatus(result.success ? 'converged' : 'failed');

    // Show in status bar
    setSolverProgress(null);
    if (result.success) {
      setSolveResult({
        potential: new Float32Array(0),
        width: 0, height: 0,
        iterations: 1,
        residual: 0,
        converged: true,
        timeMs,
      });
    }
  };

  const handleSolve = () => {
    if (mode === 'circuit') {
      handleSolveCircuit();
    } else {
      handleSolveField();
    }
  };

  const handleCancel = () => {
    getWorkerManager().cancel();
    setSolverStatus('cancelled');
  };

  const handleEngineChange = (engine: FieldEngineType) => {
    const run = getActiveRun();
    if (!run) return;
    forkRun(run.id, { engine });
  };

  const handleModeSwitch = (newMode: 'field' | 'circuit') => {
    setMode(newMode);
    if (newMode === 'circuit') {
      const run = getActiveRun();
      if (!run?.circuitConfig) {
        // Auto-load first demo circuit
        createCircuitRun(DEMO_CIRCUITS[0].factory());
      }
    }
  };

  const handleLoadDemo = (index: number) => {
    const demo = DEMO_CIRCUITS[index];
    if (demo) {
      createCircuitRun(demo.factory());
    }
  };

  const run = getActiveRun();
  const currentEngine = run?.config.engine ?? 'gauss_seidel';
  const isCircuit = mode === 'circuit';

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${!isCircuit ? 'active' : ''}`}
          onClick={() => handleModeSwitch('field')}
        >
          Field
        </button>
        <button
          className={`toolbar-btn ${isCircuit ? 'active' : ''}`}
          onClick={() => handleModeSwitch('circuit')}
        >
          Circuit
        </button>
      </div>

      <div className="toolbar-divider" />

      {solverStatus === 'solving' && !isCircuit ? (
        <button className="toolbar-btn cancel-btn" onClick={handleCancel}>
          Cancel
        </button>
      ) : (
        <button className="toolbar-btn solve-btn" onClick={handleSolve}>
          Solve
        </button>
      )}

      <div className="toolbar-divider" />

      {isCircuit ? (
        <div className="toolbar-group">
          <label className="toolbar-label">
            Demo:
            <select
              onChange={(e) => handleLoadDemo(Number(e.target.value))}
              className="toolbar-select"
              defaultValue=""
            >
              <option value="" disabled>Load circuit...</option>
              {DEMO_CIRCUITS.map((demo, i) => (
                <option key={i} value={i}>{demo.name}</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <>
          <div className="toolbar-group">
            <label className="toolbar-label">
              Engine:
              <select
                value={currentEngine}
                onChange={(e) => handleEngineChange(e.target.value as FieldEngineType)}
                className="toolbar-select"
              >
                <option value="jacobi">Jacobi</option>
                <option value="gauss_seidel">Gauss-Seidel</option>
                <option value="sor">SOR</option>
              </select>
            </label>
          </div>

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
            >
              Contours
            </button>
            <button
              className={`toolbar-btn toggle ${showVectors ? 'active' : ''}`}
              onClick={toggleVectors}
            >
              Vectors
            </button>
            <button
              className={`toolbar-btn toggle ${showGrid ? 'active' : ''}`}
              onClick={toggleGrid}
            >
              Grid
            </button>
          </div>
        </>
      )}
    </div>
  );
}
