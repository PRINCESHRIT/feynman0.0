/**
 * Sweep Engine Tests — Phase 8.
 *
 * Tests parametric sweep config generation, parameter application,
 * and sweep execution including diverging run handling.
 */

import { describe, it, expect } from 'vitest';
import { generateSweepConfigs, runSweep } from '../src/solver/sweepEngine';
import type { FieldConfig } from '../src/types/simulation';

const baseConfig: FieldConfig = {
  grid: { width: 17, height: 17 },
  charges: [{ id: 'q1', x: 8, y: 8, q: 1.0 }],
  boundary: { type: 'dirichlet_zero' },
  engine: 'gauss_seidel',
  maxIterations: 500,
  tolerance: 1e-4,
};

describe('generateSweepConfigs', () => {
  it('generates correct number of configs', () => {
    const { values, configs } = generateSweepConfigs(baseConfig, {
      parameter: { type: 'charge_q', chargeId: 'q1', label: 'Q' },
      start: -3,
      end: 3,
      steps: 7,
    });

    expect(values.length).toBe(7);
    expect(configs.length).toBe(7);
  });

  it('values span start to end linearly', () => {
    const { values } = generateSweepConfigs(baseConfig, {
      parameter: { type: 'charge_q', chargeId: 'q1', label: 'Q' },
      start: 0,
      end: 10,
      steps: 6,
    });

    expect(values[0]).toBeCloseTo(0, 10);
    expect(values[5]).toBeCloseTo(10, 10);
    expect(values[1]).toBeCloseTo(2, 10);
    expect(values[2]).toBeCloseTo(4, 10);
  });

  it('charge_q sweep modifies charge q values correctly', () => {
    const { configs, values } = generateSweepConfigs(baseConfig, {
      parameter: { type: 'charge_q', chargeId: 'q1', label: 'Q' },
      start: -2,
      end: 2,
      steps: 5,
    });

    for (let i = 0; i < configs.length; i++) {
      const charge = configs[i].charges.find((c) => c.id === 'q1');
      expect(charge).toBeDefined();
      expect(charge!.q).toBeCloseTo(values[i], 10);
    }
  });

  it('charge_x sweep modifies charge x and clamps to grid', () => {
    const { configs } = generateSweepConfigs(baseConfig, {
      parameter: { type: 'charge_x', chargeId: 'q1', label: 'X' },
      start: -5,
      end: 20,
      steps: 5,
    });

    for (const config of configs) {
      const charge = config.charges.find((c) => c.id === 'q1');
      expect(charge).toBeDefined();
      expect(charge!.x).toBeGreaterThanOrEqual(0);
      expect(charge!.x).toBeLessThanOrEqual(config.grid.width - 1);
    }
  });

  it('resolution sweep modifies grid size and clamps [16, 512]', () => {
    const { configs } = generateSweepConfigs(baseConfig, {
      parameter: { type: 'resolution', label: 'Res' },
      start: 10,
      end: 600,
      steps: 5,
    });

    for (const config of configs) {
      expect(config.grid.width).toBeGreaterThanOrEqual(16);
      expect(config.grid.width).toBeLessThanOrEqual(512);
      expect(config.grid.width).toBe(config.grid.height);
    }
  });

  it('caps at 50 steps', () => {
    const { configs } = generateSweepConfigs(baseConfig, {
      parameter: { type: 'charge_q', chargeId: 'q1', label: 'Q' },
      start: 0,
      end: 100,
      steps: 200,
    });

    expect(configs.length).toBe(50);
  });

  it('single step returns start value with base config', () => {
    const { values, configs } = generateSweepConfigs(baseConfig, {
      parameter: { type: 'charge_q', chargeId: 'q1', label: 'Q' },
      start: 5,
      end: 10,
      steps: 1,
    });

    expect(values.length).toBe(1);
    expect(values[0]).toBe(5);
    expect(configs.length).toBe(1);
  });
});

describe('runSweep', () => {
  it('completes all steps and calls onProgress', async () => {
    const progressCalls: number[] = [];

    const result = await runSweep(
      baseConfig,
      {
        parameter: { type: 'charge_q', chargeId: 'q1', label: 'Q' },
        start: 0.5,
        end: 2.0,
        steps: 3,
      },
      (progress) => {
        progressCalls.push(progress.completed);
      },
    );

    expect(result.completed).toBe(3);
    expect(result.total).toBe(3);
    expect(result.results.length).toBe(3);
    expect(progressCalls).toEqual([1, 2, 3]);
  });

  it('each result has timing and convergence info', async () => {
    const result = await runSweep(
      baseConfig,
      {
        parameter: { type: 'charge_q', chargeId: 'q1', label: 'Q' },
        start: 1,
        end: 1,
        steps: 2,
      },
      () => {},
    );

    for (const r of result.results) {
      expect(r).toHaveProperty('converged');
      expect(r).toHaveProperty('residual');
      expect(r).toHaveProperty('iterations');
      expect(r).toHaveProperty('timeMs');
      expect(r.timeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('failed/diverging runs are counted but sweep continues', async () => {
    // Force non-convergence: large grid, huge charge, 1 iteration, impossibly tight tolerance
    const toughConfig: FieldConfig = {
      ...baseConfig,
      grid: { width: 33, height: 33 },
      maxIterations: 1,
      tolerance: 1e-20, // impossibly tight — 1 iteration can't converge
    };

    const result = await runSweep(
      toughConfig,
      {
        parameter: { type: 'charge_q', chargeId: 'q1', label: 'Q' },
        start: 10,
        end: 50,
        steps: 3,
      },
      () => {},
    );

    // All should complete (not throw)
    expect(result.completed).toBe(3);
    // With 1 iteration on 33x33 with tol=1e-20, these should fail to converge
    expect(result.failed).toBeGreaterThan(0);
    // Sweep still ran all points
    expect(result.results.length).toBe(3);
  });
});
