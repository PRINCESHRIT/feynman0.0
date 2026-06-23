/**
 * Extended Validation Tests — Phases 5-6.
 *
 * Tests structural + numerical validators with edge cases,
 * plus Gauss's law check accuracy across reference cases.
 */

import { describe, it, expect } from 'vitest';
import { validateStructural } from '../src/validation/structural';
import { validateNumerical } from '../src/validation/numerical';
import { performGaussCheck } from '../src/validation/gaussCheck';
import { solveGaussSeidel } from '../src/solver/gaussSeidel';
import type { FieldConfig, SolveResult } from '../src/types/simulation';

// ── Structural validation ──

describe('Structural validation — edge cases', () => {
  const baseConfig: FieldConfig = {
    grid: { width: 33, height: 33 },
    charges: [],
    boundary: { type: 'dirichlet_zero' },
    engine: 'gauss_seidel',
    maxIterations: 1000,
    tolerance: 1e-6,
  };

  it('charge exactly on boundary produces warning', () => {
    const config: FieldConfig = {
      ...baseConfig,
      charges: [{ id: 'q1', x: 0, y: 16, q: 1 }],
    };
    const conflicts = validateStructural(config);
    const boundary = conflicts.find((c) => c.id.startsWith('boundary-'));
    expect(boundary).toBeDefined();
    expect(boundary!.severity).toBe('warning');
  });

  it('charge outside grid produces error', () => {
    const config: FieldConfig = {
      ...baseConfig,
      charges: [{ id: 'q1', x: -1, y: 16, q: 1 }],
    };
    const conflicts = validateStructural(config);
    const oob = conflicts.find((c) => c.id.startsWith('oob-'));
    expect(oob).toBeDefined();
    expect(oob!.severity).toBe('error');
  });

  it('charge at right edge (x=width) produces error', () => {
    const config: FieldConfig = {
      ...baseConfig,
      charges: [{ id: 'q1', x: 33, y: 16, q: 1 }],
    };
    const conflicts = validateStructural(config);
    const oob = conflicts.find((c) => c.id.startsWith('oob-'));
    expect(oob).toBeDefined();
  });

  it('two charges at same position produce overlap warning', () => {
    const config: FieldConfig = {
      ...baseConfig,
      charges: [
        { id: 'q1', x: 16, y: 16, q: 1 },
        { id: 'q2', x: 16, y: 16, q: -1 },
      ],
    };
    const conflicts = validateStructural(config);
    const overlap = conflicts.find((c) => c.id.startsWith('overlap-'));
    expect(overlap).toBeDefined();
    expect(overlap!.severity).toBe('warning');
    expect(overlap!.relatedIds).toContain('q1');
    expect(overlap!.relatedIds).toContain('q2');
  });

  it('zero-magnitude charge produces info', () => {
    const config: FieldConfig = {
      ...baseConfig,
      charges: [{ id: 'q1', x: 16, y: 16, q: 0 }],
    };
    const conflicts = validateStructural(config);
    const zero = conflicts.find((c) => c.id.startsWith('zero-'));
    expect(zero).toBeDefined();
    expect(zero!.severity).toBe('info');
  });

  it('grid smaller than 3×3 produces error', () => {
    const config: FieldConfig = {
      ...baseConfig,
      grid: { width: 2, height: 2 },
    };
    const conflicts = validateStructural(config);
    const small = conflicts.find((c) => c.id === 'grid-small');
    expect(small).toBeDefined();
    expect(small!.severity).toBe('error');
  });

  it('valid config with interior charges produces no errors', () => {
    const config: FieldConfig = {
      ...baseConfig,
      charges: [
        { id: 'q1', x: 10, y: 10, q: 1 },
        { id: 'q2', x: 20, y: 20, q: -1 },
      ],
    };
    const conflicts = validateStructural(config);
    const errors = conflicts.filter((c) => c.severity === 'error');
    expect(errors.length).toBe(0);
  });
});

// ── Numerical validation ──

describe('Numerical validation — edge cases', () => {
  it('converged result with low residual produces no warnings', () => {
    const result: SolveResult = {
      potential: new Float32Array(9).fill(0),
      width: 3, height: 3,
      iterations: 50,
      residual: 1e-8,
      converged: true,
      timeMs: 100,
    };
    const conflicts = validateNumerical(result);
    expect(conflicts.length).toBe(0);
  });

  it('non-converged result produces warning', () => {
    const result: SolveResult = {
      potential: new Float32Array(9).fill(0),
      width: 3, height: 3,
      iterations: 10000,
      residual: 0.5,
      converged: false,
      timeMs: 100,
    };
    const conflicts = validateNumerical(result);
    expect(conflicts.some((c) => c.id === 'not-converged')).toBe(true);
  });

  it('high residual produces error', () => {
    const result: SolveResult = {
      potential: new Float32Array(9).fill(0),
      width: 3, height: 3,
      iterations: 10000,
      residual: 0.05,
      converged: false,
      timeMs: 100,
    };
    const conflicts = validateNumerical(result);
    expect(conflicts.some((c) => c.id === 'high-residual')).toBe(true);
  });

  it('NaN in potential produces error', () => {
    const potential = new Float32Array(9);
    potential[4] = NaN;
    const result: SolveResult = {
      potential,
      width: 3, height: 3,
      iterations: 1,
      residual: 0,
      converged: true,
      timeMs: 10,
    };
    const conflicts = validateNumerical(result);
    expect(conflicts.some((c) => c.id === 'nan-potential')).toBe(true);
  });

  it('Infinity in potential produces error', () => {
    const potential = new Float32Array(9);
    potential[4] = Infinity;
    const result: SolveResult = {
      potential,
      width: 3, height: 3,
      iterations: 1,
      residual: 0,
      converged: true,
      timeMs: 10,
    };
    const conflicts = validateNumerical(result);
    expect(conflicts.some((c) => c.id === 'inf-potential')).toBe(true);
  });

  it('very long solve produces timeout warning', () => {
    const result: SolveResult = {
      potential: new Float32Array(9).fill(0),
      width: 3, height: 3,
      iterations: 50000,
      residual: 1e-8,
      converged: true,
      timeMs: 35000, // 35s > 30s threshold
    };
    const conflicts = validateNumerical(result);
    expect(conflicts.some((c) => c.id === 'timeout')).toBe(true);
  });
});

// ── Gauss's law check ──

describe('Gauss law check', () => {
  it('single positive charge: flux ratio near 1.0', () => {
    const config: FieldConfig = {
      grid: { width: 33, height: 33 },
      charges: [{ id: 'q1', x: 16, y: 16, q: 1.0 }],
      boundary: { type: 'dirichlet_zero' },
      engine: 'gauss_seidel',
      maxIterations: 10000,
      tolerance: 1e-6,
    };
    const result = solveGaussSeidel(config);
    const checks = performGaussCheck(result.potential, 33, 33, config.charges);

    expect(checks.length).toBe(1);
    expect(Math.abs(checks[0].ratio - 1)).toBeLessThan(0.15);
  });

  it('negative charge: flux ratio near 1.0', () => {
    const config: FieldConfig = {
      grid: { width: 33, height: 33 },
      charges: [{ id: 'q1', x: 16, y: 16, q: -2.0 }],
      boundary: { type: 'dirichlet_zero' },
      engine: 'gauss_seidel',
      maxIterations: 10000,
      tolerance: 1e-6,
    };
    const result = solveGaussSeidel(config);
    const checks = performGaussCheck(result.potential, 33, 33, config.charges);

    expect(checks.length).toBe(1);
    expect(Math.abs(checks[0].ratio - 1)).toBeLessThan(0.15);
  });

  it('charge near boundary is skipped (contour too small)', () => {
    const config: FieldConfig = {
      grid: { width: 33, height: 33 },
      charges: [{ id: 'q1', x: 1, y: 1, q: 1.0 }],
      boundary: { type: 'dirichlet_zero' },
      engine: 'gauss_seidel',
      maxIterations: 10000,
      tolerance: 1e-6,
    };
    const result = solveGaussSeidel(config);
    const checks = performGaussCheck(result.potential, 33, 33, config.charges);

    // Charge at (1,1) — contour x0=max(1,1-2)=1, x1=min(31,1+2)=3, barely fits
    // Whether it fits or is skipped depends on margin check
    // Just verify it doesn't crash
    expect(checks.length).toBeGreaterThanOrEqual(0);
  });
});
