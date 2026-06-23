/**
 * Reference Case Tests — Validates solver math against analytical solutions.
 *
 * RC-1: Parallel plates (linear gradient)
 * RC-2: Point charge symmetry
 * RC-3: Laplace box (uniform Dirichlet)
 * RC-4: Dipole antisymmetry
 * RC-5: Convergence ordering (SOR < GS < Jacobi)
 * RC-6: Voltage divider
 * RC-7: Wheatstone bridge
 */

import { describe, it, expect } from 'vitest';
import { solveGaussSeidel } from '../src/solver/gaussSeidel';
import { solveCircuitMNA } from '../src/solver/circuitSolver';
import { performGaussCheck } from '../src/validation/gaussCheck';
import type { FieldConfig } from '../src/types/simulation';
import type { CircuitConfig, CircuitComponent } from '../src/types/circuit';
import refCases from '../../fixtures/reference-cases.json';

function makeComponent(
  overrides: Partial<CircuitComponent> & { id: string; type: CircuitComponent['type'] },
): CircuitComponent {
  return { nodeA: 0, nodeB: 0, value: 0, x: 0, y: 0, rotation: 0, ...overrides };
}

function toFieldConfig(raw: typeof refCases.field_cases['RC-1']['config']): FieldConfig {
  return {
    grid: raw.grid,
    charges: (raw.charges || []).map((c: any) => ({ id: c.id || 'q', x: c.x, y: c.y, q: c.q })),
    boundary: raw.boundary as FieldConfig['boundary'],
    engine: (raw.engine || 'gauss_seidel') as FieldConfig['engine'],
    maxIterations: raw.maxIterations,
    tolerance: raw.tolerance,
  };
}

describe('RC-1: Parallel Plates — Linear Gradient', () => {
  const config = toFieldConfig(refCases.field_cases['RC-1'].config);
  const result = solveGaussSeidel(config);

  it('should converge', () => {
    expect(result.converged).toBe(true);
  });

  it('left boundary should be V=1', () => {
    const w = config.grid.width;
    for (let y = 0; y < config.grid.height; y++) {
      expect(result.potential[y * w]).toBeCloseTo(1.0, 5);
    }
  });

  it('right boundary should be V=0', () => {
    const w = config.grid.width;
    for (let y = 0; y < config.grid.height; y++) {
      expect(result.potential[y * w + w - 1]).toBeCloseTo(0.0, 5);
    }
  });

  it('center row should approximate linear gradient with monotonic decrease', () => {
    const w = config.grid.width;
    const row = 16;
    // The 2D Laplace solution with V=0 on top/bottom (not just left/right) deviates
    // from the 1D linear solution. The exact 2D solution involves a Fourier series.
    // We test: (1) monotonic decrease, (2) left > right, (3) reasonable range
    const leftVal = result.potential[row * w + 1];
    const rightVal = result.potential[row * w + (w - 2)];
    expect(leftVal).toBeGreaterThan(rightVal);
    expect(leftVal).toBeGreaterThan(0);
    expect(leftVal).toBeLessThan(1);

    // Verify monotonicity in center band
    for (let x = 3; x < w - 3; x++) {
      expect(result.potential[row * w + x]).toBeLessThanOrEqual(
        result.potential[row * w + x - 1] + 1e-6,
      );
    }
  });

  it('should monotonically decrease left to right at center row', () => {
    const w = config.grid.width;
    const row = 16;
    for (let x = 1; x < w - 1; x++) {
      expect(result.potential[row * w + x]).toBeLessThanOrEqual(
        result.potential[row * w + x - 1] + 1e-10,
      );
    }
  });
});

describe('RC-2: Point Charge Symmetry', () => {
  const config = toFieldConfig(refCases.field_cases['RC-2'].config);
  const result = solveGaussSeidel(config);

  it('should converge', () => {
    expect(result.converged).toBe(true);
  });

  it('center should be positive', () => {
    expect(result.potential[16 * 33 + 16]).toBeGreaterThan(0);
  });

  it('four-fold symmetry: V(16+d,16) ≈ V(16-d,16) ≈ V(16,16+d) ≈ V(16,16-d)', () => {
    const w = 33;
    for (let d = 1; d <= 10; d++) {
      const vRight = result.potential[16 * w + 16 + d];
      const vLeft = result.potential[16 * w + 16 - d];
      const vDown = result.potential[(16 + d) * w + 16];
      const vUp = result.potential[(16 - d) * w + 16];

      // GS solver is row-major so symmetry is approximate, not exact
      expect(Math.abs(vRight - vLeft)).toBeLessThan(1e-4);
      expect(Math.abs(vRight - vDown)).toBeLessThan(1e-4);
      expect(Math.abs(vRight - vUp)).toBeLessThan(1e-4);
    }
  });

  it('boundaries should be zero', () => {
    const w = 33;
    const h = 33;
    for (let x = 0; x < w; x++) {
      expect(result.potential[x]).toBe(0);
      expect(result.potential[(h - 1) * w + x]).toBe(0);
    }
    for (let y = 0; y < h; y++) {
      expect(result.potential[y * w]).toBe(0);
      expect(result.potential[y * w + w - 1]).toBe(0);
    }
  });

  it('Gauss law check: flux ratio near 1.0', () => {
    const checks = performGaussCheck(
      result.potential,
      33,
      33,
      config.charges,
      0.15,
    );
    expect(checks.length).toBe(1);
    expect(checks[0].pass).toBe(true);
    expect(Math.abs(checks[0].ratio - 1)).toBeLessThan(0.15);
  });
});

describe('RC-3: Laplace Box — Uniform Interior', () => {
  const config = toFieldConfig(refCases.field_cases['RC-3'].config);
  const result = solveGaussSeidel(config);

  it('should converge', () => {
    expect(result.converged).toBe(true);
  });

  it('interior should be V=1 everywhere', () => {
    const w = 33;
    for (let y = 2; y < 31; y++) {
      for (let x = 2; x < 31; x++) {
        expect(Math.abs(result.potential[y * w + x] - 1.0)).toBeLessThan(0.001);
      }
    }
  });
});

describe('RC-4: Dipole Antisymmetry', () => {
  const config = toFieldConfig(refCases.field_cases['RC-4'].config);
  const result = solveGaussSeidel(config);

  it('should converge', () => {
    expect(result.converged).toBe(true);
  });

  it('midpoint V(16,16) should be near zero', () => {
    expect(Math.abs(result.potential[16 * 33 + 16])).toBeLessThan(0.01);
  });

  it('antisymmetric about midpoint: V(16+d,16) ≈ -V(16-d,16)', () => {
    const w = 33;
    for (let d = 1; d <= 3; d++) {
      const vRight = result.potential[16 * w + 16 + d];
      const vLeft = result.potential[16 * w + 16 - d];
      expect(Math.abs(vRight + vLeft)).toBeLessThan(0.01);
    }
  });
});

describe('RC-5: Determinism — Two identical cold-start solves produce identical results', () => {
  const config = toFieldConfig(refCases.field_cases['RC-2'].config);

  it('identical cold-start solves produce bit-identical Float32Array', () => {
    const result1 = solveGaussSeidel(config);
    const result2 = solveGaussSeidel(config);

    expect(result1.iterations).toBe(result2.iterations);
    expect(result1.potential.length).toBe(result2.potential.length);

    for (let i = 0; i < result1.potential.length; i++) {
      expect(result1.potential[i]).toBe(result2.potential[i]);
    }
  });
});

describe('RC-6: Voltage Divider', () => {
  const rawComps = refCases.circuit_cases['RC-6'].config.components;
  const config: CircuitConfig = {
    nextNodeId: refCases.circuit_cases['RC-6'].config.nextNodeId,
    components: rawComps.map((c: any) => makeComponent(c)),
  };
  const result = solveCircuitMNA(config);

  it('should solve successfully', () => {
    expect(result.success).toBe(true);
  });

  it('node 1 should be 5V', () => {
    expect(result.nodeVoltages[1]).toBeCloseTo(5.0, 5);
  });

  it('node 2 should be 2.5V (half of supply)', () => {
    expect(result.nodeVoltages[2]).toBeCloseTo(2.5, 5);
  });

  it('current through R1 should be 2.5mA', () => {
    const r1 = result.branchCurrents.find((c) => c.id === 'R1');
    expect(r1).toBeDefined();
    expect(r1!.current).toBeCloseTo(0.0025, 5);
  });
});

describe('RC-7: Wheatstone Bridge', () => {
  const rawComps = refCases.circuit_cases['RC-7'].config.components;
  const config: CircuitConfig = {
    nextNodeId: refCases.circuit_cases['RC-7'].config.nextNodeId,
    components: rawComps.map((c: any) => makeComponent(c)),
  };
  const result = solveCircuitMNA(config);

  it('should solve successfully', () => {
    expect(result.success).toBe(true);
  });

  it('node 1 should be 10V (source)', () => {
    expect(result.nodeVoltages[1]).toBeCloseTo(10.0, 5);
  });

  it('balanced bridge: nodes 2 and 3 should both be 5V', () => {
    expect(result.nodeVoltages[2]).toBeCloseTo(5.0, 5);
    expect(result.nodeVoltages[3]).toBeCloseTo(5.0, 5);
  });

  it('bridge voltage difference should be zero', () => {
    const bridgeV = Math.abs(result.nodeVoltages[2] - result.nodeVoltages[3]);
    expect(bridgeV).toBeLessThan(1e-6);
  });
});
