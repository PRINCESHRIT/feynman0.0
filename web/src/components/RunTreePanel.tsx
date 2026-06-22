import { useStore } from '../state/store';
import './RunTreePanel.css';

export function RunTreePanel() {
  const runs = useStore((s) => s.runs);
  const activeRunId = useStore((s) => s.activeRunId);
  const setActiveRun = useStore((s) => s.setActiveRun);

  const runList = Array.from(runs.values()).sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="run-tree-panel">
      <div className="run-tree-header">Run Tree</div>
      <div className="run-tree-list">
        {runList.map((run) => (
          <button
            key={run.id}
            className={`run-tree-item ${run.id === activeRunId ? 'active' : ''}`}
            onClick={() => setActiveRun(run.id)}
          >
            <span className="run-status">
              {run.result
                ? run.result.converged
                  ? '✓'
                  : '⚠'
                : '○'}
            </span>
            <span className="run-label">{run.label}</span>
            <span className="run-charges">{run.config.charges.length}q</span>
          </button>
        ))}
      </div>
    </div>
  );
}
