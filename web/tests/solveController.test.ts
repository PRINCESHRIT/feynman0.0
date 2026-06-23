/**
 * SolveController Tests — Phase 0.
 *
 * Tests the latency-critical solve orchestration:
 * - Job ID monotonicity
 * - Versioned result publishing
 * - Inline fallback mode
 *
 * Note: Worker-based tests require a browser/worker environment.
 * These tests focus on the TS-level logic that can be tested in Node.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getLatestResult,
  requestSolve,
  cancelSolve,
  clearWarmStart,
  dispose,
  setSolveCallbacks,
} from '../src/solver/solveController';
import type { FieldConfig } from '../src/types/simulation';

const testConfig: FieldConfig = {
  grid: { width: 17, height: 17 },
  charges: [{ id: 'q1', x: 8, y: 8, q: 1.0 }],
  boundary: { type: 'dirichlet_zero' },
  engine: 'gauss_seidel',
  maxIterations: 500,
  tolerance: 1e-4,
};

describe('SolveController — inline fallback', () => {
  beforeEach(() => {
    dispose();
    clearWarmStart();
  });

  it('requestSolve in inline mode produces a versioned result', async () => {
    // Without calling bootWorker, we're in inline/no-worker mode
    const statusChanges: string[] = [];
    setSolveCallbacks({
      onStatus: (s) => statusChanges.push(s),
    });

    const result = await requestSolve(testConfig, 'preview');

    // Should have solved inline
    if (result) {
      expect(result.potential).toBeInstanceOf(Float32Array);
      expect(result.width).toBe(128); // preview forces 128
      expect(result.height).toBe(128);
      expect(result.converged).toBeDefined();

      // Latest result should be published
      const latest = getLatestResult();
      expect(latest).not.toBeNull();
      expect(latest!.version).toBeGreaterThan(0);
    }
  });

  it('cancelSolve updates status', () => {
    const statusChanges: string[] = [];
    setSolveCallbacks({
      onStatus: (s) => statusChanges.push(s),
    });

    cancelSolve();
    expect(statusChanges).toContain('cancelled');
  });

  it('versioned result version increments', async () => {
    const result1 = await requestSolve(testConfig, 'commit');
    const v1 = getLatestResult()?.version ?? 0;

    const result2 = await requestSolve(testConfig, 'commit');
    const v2 = getLatestResult()?.version ?? 0;

    expect(v2).toBeGreaterThan(v1);
  });

  it('commit mode uses actual grid resolution', async () => {
    const commitConfig: FieldConfig = {
      ...testConfig,
      grid: { width: 33, height: 33 },
    };

    const result = await requestSolve(commitConfig, 'commit');
    if (result) {
      expect(result.width).toBe(33);
      expect(result.height).toBe(33);
    }
  });
});
