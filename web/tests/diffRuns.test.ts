import { describe, it, expect } from 'vitest';
import { computeDiff } from '../src/solver/diffRuns';

describe('Run diffing', () => {
  it('identical fields produce zero diff', () => {
    const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const result = computeDiff(data, 3, 3, data, 3, 3);
    expect(result.maxDelta).toBe(0);
    expect(result.rmsDelta).toBe(0);
    expect(result.isResampled).toBe(false);
  });

  it('different fields produce correct max delta', () => {
    const a = new Float32Array([0, 0, 0, 0, 5, 0, 0, 0, 0]);
    const b = new Float32Array([0, 0, 0, 0, 2, 0, 0, 0, 0]);
    const result = computeDiff(a, 3, 3, b, 3, 3);
    expect(result.maxDelta).toBeCloseTo(3, 5);
    expect(result.maxDeltaX).toBe(1);
    expect(result.maxDeltaY).toBe(1);
  });

  it('cross-resolution uses bilinear interpolation', () => {
    // 3x3 uniform field at value 1
    const a = new Float32Array(9).fill(1.0);
    // 5x5 uniform field at value 1
    const b = new Float32Array(25).fill(1.0);
    const result = computeDiff(a, 3, 3, b, 5, 5);
    expect(result.isResampled).toBe(true);
    // Uniform fields should still diff to ~0
    expect(result.maxDelta).toBeCloseTo(0, 5);
  });

  it('cross-resolution diff produces reasonable RMS', () => {
    // 3x3 at value 2
    const a = new Float32Array(9).fill(2.0);
    // 5x5 at value 1
    const b = new Float32Array(25).fill(1.0);
    const result = computeDiff(a, 3, 3, b, 5, 5);
    expect(result.isResampled).toBe(true);
    expect(result.rmsDelta).toBeCloseTo(1, 5);
  });
});
