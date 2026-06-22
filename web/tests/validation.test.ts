import { describe, it, expect } from 'vitest';
import { validateStructural } from '../src/validation/structural';
import { validateNumerical } from '../src/validation/numerical';
import type { FieldConfig, SolveResult } from '../src/types/simulation';

const baseConfig: FieldConfig = {
  grid: { width: 32, height: 32 },
  charges: [],
  boundary: { type: 'dirichlet_zero' },
  engine: 'gauss_seidel',
  maxIterations: 10000,
  tolerance: 1e-6,
};

describe('Structural validation', () => {
  it('empty config has no conflicts', () => {
    expect(validateStructural(baseConfig)).toHaveLength(0);
  });

  it('out-of-bounds charge produces error', () => {
    const config = {
      ...baseConfig,
      charges: [{ id: 'q1', x: 50, y: 16, q: 1.0 }],
    };
    const conflicts = validateStructural(config);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('error');
    expect(conflicts[0].relatedIds).toContain('q1');
  });

  it('overlapping charges produce warning', () => {
    const config = {
      ...baseConfig,
      charges: [
        { id: 'q1', x: 16, y: 16, q: 1.0 },
        { id: 'q2', x: 16, y: 16, q: -1.0 },
      ],
    };
    const conflicts = validateStructural(config);
    const overlap = conflicts.find((c) => c.id.startsWith('overlap'));
    expect(overlap).toBeDefined();
    expect(overlap!.severity).toBe('warning');
  });

  it('charge on boundary produces warning', () => {
    const config = {
      ...baseConfig,
      charges: [{ id: 'q1', x: 0, y: 16, q: 1.0 }],
    };
    const conflicts = validateStructural(config);
    expect(conflicts.some((c) => c.id.startsWith('boundary'))).toBe(true);
  });

  it('grid too small produces error', () => {
    const config = { ...baseConfig, grid: { width: 2, height: 2 } };
    const conflicts = validateStructural(config);
    expect(conflicts.some((c) => c.id === 'grid-small')).toBe(true);
  });
});

describe('Numerical validation', () => {
  const baseResult: SolveResult = {
    potential: new Float32Array(100),
    width: 10,
    height: 10,
    iterations: 500,
    residual: 1e-7,
    converged: true,
    timeMs: 100,
  };

  it('converged result has no conflicts', () => {
    expect(validateNumerical(baseResult)).toHaveLength(0);
  });

  it('non-converged result produces warning', () => {
    const result = { ...baseResult, converged: false, residual: 1e-3 };
    const conflicts = validateNumerical(result);
    expect(conflicts.some((c) => c.id === 'not-converged')).toBe(true);
  });

  it('high residual produces error', () => {
    const result = { ...baseResult, converged: false, residual: 0.5 };
    const conflicts = validateNumerical(result);
    expect(conflicts.some((c) => c.id === 'high-residual')).toBe(true);
  });

  it('NaN in potential produces error', () => {
    const pot = new Float32Array(100);
    pot[50] = NaN;
    const result = { ...baseResult, potential: pot };
    const conflicts = validateNumerical(result);
    expect(conflicts.some((c) => c.id === 'nan-potential')).toBe(true);
  });
});
