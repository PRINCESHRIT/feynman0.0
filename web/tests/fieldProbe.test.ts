/**
 * Field Probe Tests — Phase 6.
 *
 * Key invariant: Probes are read-only. They read from the latest solved
 * result and NEVER trigger a new solve. This tests the probe logic
 * against known field data.
 */

import { describe, it, expect } from 'vitest';
import { computeFieldVectors } from '../src/solver/fieldVectors';

describe('Field probe — read from solved potential', () => {
  // Simulate what a probe would do: read V and E at a grid point

  it('reads voltage from known potential array', () => {
    const width = 5;
    const height = 5;
    const potential = new Float32Array(width * height);
    // Set a known value at (2,2)
    potential[2 * width + 2] = 3.14;

    // Probe read: just index into the array
    const gx = 2, gy = 2;
    const voltage = potential[gy * width + gx];
    expect(voltage).toBeCloseTo(3.14, 5); // Float32 precision
  });

  it('reads E-field from central differences at interior point', () => {
    const width = 5;
    const height = 5;
    // Linear gradient: V increases with x → E points in -x direction
    const potential = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        potential[y * width + x] = x * 2.0; // V = 2x
      }
    }

    const field = computeFieldVectors(potential, width, height);

    // At interior point (2,2): Ex = -(V(3,2) - V(1,2))/2 = -(6-2)/2 = -2
    const idx = 2 * width + 2;
    expect(field.ex[idx]).toBeCloseTo(-2.0, 5);
    expect(field.ey[idx]).toBeCloseTo(0.0, 5);
  });

  it('E-field magnitude is correct for diagonal gradient', () => {
    const width = 5;
    const height = 5;
    // V = x + y → Ex = -1, Ey = -1, |E| = sqrt(2)
    const potential = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        potential[y * width + x] = x + y;
      }
    }

    const field = computeFieldVectors(potential, width, height);
    const idx = 2 * width + 2;
    expect(field.ex[idx]).toBeCloseTo(-1.0, 5);
    expect(field.ey[idx]).toBeCloseTo(-1.0, 5);

    const magnitude = Math.sqrt(field.ex[idx] ** 2 + field.ey[idx] ** 2);
    expect(magnitude).toBeCloseTo(Math.SQRT2, 5);
  });

  it('boundary-adjacent probe still returns valid values', () => {
    const width = 5;
    const height = 5;
    const potential = new Float32Array(width * height).fill(1.0);

    // Boundary points use forward/backward differences — no crash
    const field = computeFieldVectors(potential, width, height);
    expect(isFinite(field.ex[0])).toBe(true);
    expect(isFinite(field.ey[0])).toBe(true);
    expect(isFinite(field.ex[width * height - 1])).toBe(true);
    expect(isFinite(field.ey[width * height - 1])).toBe(true);
  });

  it('probe on pre-solve (all zeros) returns zero V and zero E', () => {
    const width = 5;
    const height = 5;
    const potential = new Float32Array(width * height); // all zeros

    const field = computeFieldVectors(potential, width, height);
    const idx = 2 * width + 2;
    expect(potential[idx]).toBe(0);
    expect(field.ex[idx]).toBeCloseTo(0, 10);
    expect(field.ey[idx]).toBeCloseTo(0, 10);
  });
});
