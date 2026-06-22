import type { SolveResult } from '../types/simulation';
import type { Conflict } from '../types/conflicts';

/**
 * Numerical validators — run after solve completes.
 */
export function validateNumerical(result: SolveResult): Conflict[] {
  const conflicts: Conflict[] = [];

  if (!result.converged) {
    conflicts.push({
      id: 'not-converged',
      type: 'numerical',
      severity: 'warning',
      message: `Solver did not converge after ${result.iterations} iterations (residual: ${result.residual.toExponential(2)})`,
      relatedIds: [],
    });
  }

  if (result.residual > 1e-2) {
    conflicts.push({
      id: 'high-residual',
      type: 'numerical',
      severity: 'error',
      message: `High residual (${result.residual.toExponential(2)}) — result may be inaccurate`,
      relatedIds: [],
    });
  }

  if (result.timeMs > 30000) {
    conflicts.push({
      id: 'timeout',
      type: 'numerical',
      severity: 'warning',
      message: `Solve took ${(result.timeMs / 1000).toFixed(1)}s — consider lowering resolution or using SOR`,
      relatedIds: [],
    });
  }

  // Check for NaN/Infinity in potential
  let hasNaN = false;
  let hasInf = false;
  for (let i = 0; i < result.potential.length; i++) {
    if (isNaN(result.potential[i])) hasNaN = true;
    if (!isFinite(result.potential[i])) hasInf = true;
  }
  if (hasNaN) {
    conflicts.push({
      id: 'nan-potential',
      type: 'numerical',
      severity: 'error',
      message: 'Potential contains NaN values — solver diverged',
      relatedIds: [],
    });
  }
  if (hasInf) {
    conflicts.push({
      id: 'inf-potential',
      type: 'numerical',
      severity: 'error',
      message: 'Potential contains infinite values — solver diverged',
      relatedIds: [],
    });
  }

  return conflicts;
}
