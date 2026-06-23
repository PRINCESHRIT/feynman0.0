/**
 * Parametric Sweep Engine — Phase 8.
 *
 * Generates N child runs from a parameter range and solves them
 * as a batched background job. The editor stays fully interactive.
 *
 * Sweep runs are added to the run tree as children of the base run.
 */

import type { FieldConfig, PointCharge } from '../types/simulation';
import { solveGaussSeidel } from './gaussSeidel';

export type SweepParameter =
  | { type: 'charge_q'; chargeId: string; label: string }
  | { type: 'charge_x'; chargeId: string; label: string }
  | { type: 'charge_y'; chargeId: string; label: string }
  | { type: 'resolution'; label: string };

export interface SweepConfig {
  parameter: SweepParameter;
  start: number;
  end: number;
  steps: number; // Number of points (not intervals)
}

export interface SweepResult {
  values: number[];
  configs: FieldConfig[];
  results: Array<{
    converged: boolean;
    residual: number;
    iterations: number;
    timeMs: number;
  }>;
  completed: number;
  total: number;
  failed: number;
}

const MAX_SWEEP_STEPS = 50;

/**
 * Generate sweep configs from a base config and sweep definition.
 */
export function generateSweepConfigs(
  baseConfig: FieldConfig,
  sweep: SweepConfig,
): { values: number[]; configs: FieldConfig[] } {
  const steps = Math.min(sweep.steps, MAX_SWEEP_STEPS);
  if (steps < 2) return { values: [sweep.start], configs: [baseConfig] };

  const values: number[] = [];
  const configs: FieldConfig[] = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const value = sweep.start + t * (sweep.end - sweep.start);
    values.push(value);

    const config = applyParameterValue(baseConfig, sweep.parameter, value);
    configs.push(config);
  }

  return { values, configs };
}

function applyParameterValue(
  config: FieldConfig,
  param: SweepParameter,
  value: number,
): FieldConfig {
  switch (param.type) {
    case 'charge_q':
      return {
        ...config,
        charges: config.charges.map((c) =>
          c.id === param.chargeId ? { ...c, q: value } : c,
        ),
      };
    case 'charge_x':
      return {
        ...config,
        charges: config.charges.map((c) =>
          c.id === param.chargeId
            ? { ...c, x: Math.max(0, Math.min(config.grid.width - 1, Math.round(value))) }
            : c,
        ),
      };
    case 'charge_y':
      return {
        ...config,
        charges: config.charges.map((c) =>
          c.id === param.chargeId
            ? { ...c, y: Math.max(0, Math.min(config.grid.height - 1, Math.round(value))) }
            : c,
        ),
      };
    case 'resolution': {
      const res = Math.max(16, Math.min(512, Math.round(value)));
      return {
        ...config,
        grid: { width: res, height: res },
      };
    }
  }
}

/**
 * Run a sweep. Calls onProgress after each solve.
 * A failed/diverging run is marked and skipped — the sweep completes the rest.
 */
export async function runSweep(
  baseConfig: FieldConfig,
  sweep: SweepConfig,
  onProgress: (result: SweepResult) => void,
): Promise<SweepResult> {
  const { values, configs } = generateSweepConfigs(baseConfig, sweep);

  const sweepResult: SweepResult = {
    values,
    configs,
    results: [],
    completed: 0,
    total: configs.length,
    failed: 0,
  };

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const t0 = performance.now();

    try {
      const result = solveGaussSeidel(config);
      sweepResult.results.push({
        converged: result.converged,
        residual: result.residual,
        iterations: result.iterations,
        timeMs: performance.now() - t0,
      });
      if (!result.converged) sweepResult.failed++;
    } catch {
      sweepResult.results.push({
        converged: false,
        residual: Infinity,
        iterations: 0,
        timeMs: performance.now() - t0,
      });
      sweepResult.failed++;
    }

    sweepResult.completed = i + 1;
    onProgress({ ...sweepResult });

    // Yield to keep UI responsive
    await new Promise((r) => setTimeout(r, 0));
  }

  return sweepResult;
}
