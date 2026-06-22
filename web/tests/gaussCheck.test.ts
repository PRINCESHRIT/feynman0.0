import { describe, it, expect } from 'vitest';
import { performGaussCheck } from '../src/validation/gaussCheck';
import { solveGaussSeidel } from '../src/solver/gaussSeidel';
import type { FieldConfig } from '../src/types/simulation';

describe('Gauss law surface integral check', () => {
  it('single charge: flux ratio should be near 1.0', () => {
    const config: FieldConfig = {
      grid: { width: 33, height: 33 },
      charges: [{ id: 'q1', x: 16, y: 16, q: 1.0 }],
      boundary: { type: 'dirichlet_zero' },
      engine: 'gauss_seidel',
      maxIterations: 10000,
      tolerance: 1e-6,
    };
    const result = solveGaussSeidel(config);
    expect(result.converged).toBe(true);

    const checks = performGaussCheck(
      result.potential,
      result.width,
      result.height,
      config.charges,
    );
    expect(checks).toHaveLength(1);
    // Flux ratio should be roughly 1.0 (within 20% for discrete grid)
    expect(Math.abs(checks[0].ratio - 1)).toBeLessThan(0.3);
  });

  it('dipole: each charge flux should be near expected', () => {
    const config: FieldConfig = {
      grid: { width: 33, height: 33 },
      charges: [
        { id: 'q1', x: 10, y: 16, q: 1.0 },
        { id: 'q2', x: 22, y: 16, q: -1.0 },
      ],
      boundary: { type: 'dirichlet_zero' },
      engine: 'gauss_seidel',
      maxIterations: 10000,
      tolerance: 1e-6,
    };
    const result = solveGaussSeidel(config);

    const checks = performGaussCheck(
      result.potential,
      result.width,
      result.height,
      config.charges,
    );
    expect(checks).toHaveLength(2);
    // Each should have reasonable ratio
    for (const check of checks) {
      expect(Math.abs(check.ratio - 1)).toBeLessThan(0.5);
    }
  });
});
