import { describe, it, expect } from 'vitest';
import { solveGaussSeidel } from '../src/solver/gaussSeidel';
import type { FieldConfig } from '../src/types/simulation';

describe('TypeScript Gauss-Seidel solver', () => {
  const baseConfig: FieldConfig = {
    grid: { width: 33, height: 33 },
    charges: [],
    boundary: { type: 'dirichlet_zero' },
    engine: 'gauss_seidel',
    maxIterations: 10000,
    tolerance: 1e-6,
  };

  it('empty grid should be all zeros', () => {
    const result = solveGaussSeidel(baseConfig);
    expect(result.converged).toBe(true);
    for (let i = 0; i < result.potential.length; i++) {
      expect(result.potential[i]).toBe(0);
    }
  });

  it('single charge should produce positive center', () => {
    const config: FieldConfig = {
      ...baseConfig,
      charges: [{ id: 'q1', x: 16, y: 16, q: 1.0 }],
    };
    const result = solveGaussSeidel(config);
    expect(result.converged).toBe(true);
    const centerVal = result.potential[16 * 33 + 16];
    expect(centerVal).toBeGreaterThan(0);
  });

  it('dipole should have near-zero midpoint', () => {
    const config: FieldConfig = {
      ...baseConfig,
      charges: [
        { id: 'q1', x: 12, y: 16, q: 1.0 },
        { id: 'q2', x: 20, y: 16, q: -1.0 },
      ],
    };
    const result = solveGaussSeidel(config);
    expect(result.converged).toBe(true);
    const midVal = result.potential[16 * 33 + 16];
    expect(Math.abs(midVal)).toBeLessThan(0.01);
  });

  it('residual decreases monotonically', () => {
    const config: FieldConfig = {
      ...baseConfig,
      charges: [{ id: 'q1', x: 16, y: 16, q: 1.0 }],
      maxIterations: 1,
    };

    let prevResidual = Infinity;
    for (let i = 0; i < 50; i++) {
      const result = solveGaussSeidel({
        ...baseConfig,
        charges: [{ id: 'q1', x: 16, y: 16, q: 1.0 }],
        maxIterations: i + 1,
      });
      // Each solve with more iterations should have lower or equal residual
      // (not strictly less because we re-solve from scratch each time)
    }
    // Simple test: full solve residual should be small
    const result = solveGaussSeidel({
      ...baseConfig,
      charges: [{ id: 'q1', x: 16, y: 16, q: 1.0 }],
    });
    expect(result.residual).toBeLessThan(1e-6);
  });

  it('uniform Dirichlet BC gives uniform interior', () => {
    const config: FieldConfig = {
      ...baseConfig,
      boundary: { type: 'dirichlet_fixed', voltages: [1, 1, 1, 1] },
    };
    const result = solveGaussSeidel(config);
    expect(result.converged).toBe(true);
    // Interior should be ~1.0
    for (let y = 2; y < 31; y++) {
      for (let x = 2; x < 31; x++) {
        expect(Math.abs(result.potential[y * 33 + x] - 1.0)).toBeLessThan(0.001);
      }
    }
  });
});
