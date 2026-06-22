import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../state/store';
import { computeDiff, type DiffResult } from '../solver/diffRuns';
import { renderHeatmap2D } from '../renderer/heatmapCanvas2D';
import './DiffView.css';

export function DiffView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runs = useStore((s) => s.runs);
  const diffMode = useStore((s) => s.diffMode);
  const diffRunIdA = useStore((s) => s.diffRunIdA);
  const diffRunIdB = useStore((s) => s.diffRunIdB);
  const setDiffMode = useStore((s) => s.setDiffMode);

  const runA = diffRunIdA ? runs.get(diffRunIdA) : undefined;
  const runB = diffRunIdB ? runs.get(diffRunIdB) : undefined;

  const diff = useCallback((): DiffResult | null => {
    if (!runA?.result || !runB?.result) return null;
    return computeDiff(
      runA.result.potential, runA.result.width, runA.result.height,
      runB.result.potential, runB.result.width, runB.result.height,
    );
  }, [runA, runB]);

  useEffect(() => {
    if (!diffMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const result = diff();
    if (!result) return;

    canvas.width = canvas.parentElement?.clientWidth ?? 600;
    canvas.height = canvas.parentElement?.clientHeight ?? 400;

    renderHeatmap2D(
      ctx,
      result.deltaV,
      result.width,
      result.height,
      canvas.width,
      canvas.height,
      { offsetX: 0, offsetY: 0, scale: 1 },
    );
  }, [diffMode, diff]);

  if (!diffMode) return null;

  const result = diff();

  return (
    <div className="diff-view">
      <div className="diff-header">
        <span>Diff: {runA?.label ?? '?'} vs {runB?.label ?? '?'}</span>
        <button className="diff-close" onClick={() => setDiffMode(false)}>
          Close
        </button>
      </div>
      <div className="diff-canvas-container">
        <canvas ref={canvasRef} className="diff-canvas" />
      </div>
      {result && (
        <div className="diff-stats">
          <span>Max ΔV: {result.maxDelta.toExponential(3)} at ({result.maxDeltaX}, {result.maxDeltaY})</span>
          <span>RMS: {result.rmsDelta.toExponential(3)}</span>
          {result.isResampled && (
            <span className="diff-resampled">Bilinear resampled (approximate)</span>
          )}
        </div>
      )}
    </div>
  );
}
