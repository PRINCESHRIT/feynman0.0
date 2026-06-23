/**
 * Extended Diff Tests — Phase 7.
 *
 * Tests bilinear resampling accuracy, symmetry properties,
 * and cross-resolution diff correctness.
 */

import { describe, it, expect } from 'vitest';
import { computeDiff } from '../src/solver/diffRuns';

describe('Bilinear interpolation accuracy', () => {
  it('uniform field diffed across resolutions gives zero', () => {
    const a = new Float32Array(16).fill(3.0); // 4x4
    const b = new Float32Array(64).fill(3.0); // 8x8
    const result = computeDiff(a, 4, 4, b, 8, 8);

    expect(result.isResampled).toBe(true);
    expect(result.maxDelta).toBeLessThan(1e-6);
    expect(result.rmsDelta).toBeLessThan(1e-6);
  });

  it('linear ramp preserves gradient under resampling', () => {
    // 5x1 ramp: [0, 0.25, 0.5, 0.75, 1.0]
    const a = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    // 9x1 ramp: same gradient, finer sampling
    const b = new Float32Array([0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0]);

    const result = computeDiff(a, 5, 1, b, 9, 1);
    expect(result.isResampled).toBe(true);
    // Linear interpolation of a linear function should be exact
    expect(result.maxDelta).toBeLessThan(1e-5);
  });

  it('diff is antisymmetric: diff(A,B) = -diff(B,A)', () => {
    const a = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const b = new Float32Array([9, 8, 7, 6, 5, 4, 3, 2, 1]);

    const diffAB = computeDiff(a, 3, 3, b, 3, 3);
    const diffBA = computeDiff(b, 3, 3, a, 3, 3);

    for (let i = 0; i < 9; i++) {
      expect(diffAB.deltaV[i]).toBeCloseTo(-diffBA.deltaV[i], 10);
    }
  });

  it('self-diff is always zero', () => {
    const data = new Float32Array(25);
    for (let i = 0; i < 25; i++) data[i] = Math.sin(i * 0.5);

    const result = computeDiff(data, 5, 5, data, 5, 5);
    expect(result.maxDelta).toBe(0);
    expect(result.rmsDelta).toBe(0);
  });

  it('max delta location is reported correctly', () => {
    const a = new Float32Array(9).fill(0);
    const b = new Float32Array(9).fill(0);
    b[5] = 10; // (x=2, y=1)

    const result = computeDiff(a, 3, 3, b, 3, 3);
    expect(result.maxDelta).toBe(10);
    expect(result.maxDeltaX).toBe(2);
    expect(result.maxDeltaY).toBe(1);
  });

  it('RMS is computed correctly for known values', () => {
    // A = [1,1,1,1], B = [0,0,0,0], diff = [1,1,1,1], RMS = 1.0
    const a = new Float32Array(4).fill(1);
    const b = new Float32Array(4).fill(0);
    const result = computeDiff(a, 2, 2, b, 2, 2);
    expect(result.rmsDelta).toBeCloseTo(1.0, 10);
  });
});
