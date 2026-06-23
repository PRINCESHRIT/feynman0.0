/**
 * Extended Circuit Solver Tests — Phase 4/8.
 *
 * Tests reference cases RC-6 and RC-7, plus edge cases:
 * singular matrices, floating nodes, multi-source circuits.
 */

import { describe, it, expect } from 'vitest';
import { solveCircuitMNA } from '../src/solver/circuitSolver';
import type { CircuitConfig, CircuitComponent } from '../src/types/circuit';

function comp(
  overrides: Partial<CircuitComponent> & { id: string; type: CircuitComponent['type'] },
): CircuitComponent {
  return { nodeA: 0, nodeB: 0, value: 0, x: 0, y: 0, rotation: 0, ...overrides };
}

describe('Circuit solver — extended cases', () => {
  it('series resistors: V divides proportionally', () => {
    // 10V, R1=2kΩ, R2=3kΩ → V_mid = 10 * 3/(2+3) = 6V
    const config: CircuitConfig = {
      nextNodeId: 3,
      components: [
        comp({ id: 'V1', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 10 }),
        comp({ id: 'R1', type: 'resistor', nodeA: 1, nodeB: 2, value: 2000 }),
        comp({ id: 'R2', type: 'resistor', nodeA: 2, nodeB: 0, value: 3000 }),
        comp({ id: 'GND', type: 'ground', nodeA: 0, nodeB: 0 }),
      ],
    };
    const result = solveCircuitMNA(config);
    expect(result.success).toBe(true);
    expect(result.nodeVoltages[2]).toBeCloseTo(6, 5);
  });

  it('parallel resistors: equivalent resistance', () => {
    // 10V, two 1kΩ in parallel → 500Ω → I = 10/500 = 20mA total
    const config: CircuitConfig = {
      nextNodeId: 2,
      components: [
        comp({ id: 'V1', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 10 }),
        comp({ id: 'R1', type: 'resistor', nodeA: 1, nodeB: 0, value: 1000 }),
        comp({ id: 'R2', type: 'resistor', nodeA: 1, nodeB: 0, value: 1000 }),
        comp({ id: 'GND', type: 'ground', nodeA: 0, nodeB: 0 }),
      ],
    };
    const result = solveCircuitMNA(config);
    expect(result.success).toBe(true);

    const i1 = result.branchCurrents.find((c) => c.id === 'R1');
    const i2 = result.branchCurrents.find((c) => c.id === 'R2');
    expect(i1!.current).toBeCloseTo(0.01, 5); // 10mA each
    expect(i2!.current).toBeCloseTo(0.01, 5);
  });

  it('wire creates equipotential: V(A) = V(B)', () => {
    // Wire connecting node 1 to node 2
    const config: CircuitConfig = {
      nextNodeId: 3,
      components: [
        comp({ id: 'V1', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 5 }),
        comp({ id: 'W1', type: 'wire', nodeA: 1, nodeB: 2, value: 0 }),
        comp({ id: 'R1', type: 'resistor', nodeA: 2, nodeB: 0, value: 1000 }),
        comp({ id: 'GND', type: 'ground', nodeA: 0, nodeB: 0 }),
      ],
    };
    const result = solveCircuitMNA(config);
    expect(result.success).toBe(true);
    expect(result.nodeVoltages[1]).toBeCloseTo(5, 5);
    expect(result.nodeVoltages[2]).toBeCloseTo(5, 5);
  });

  it('two voltage sources in series add up', () => {
    // V1=3V + V2=2V in series → total 5V across R
    const config: CircuitConfig = {
      nextNodeId: 3,
      components: [
        comp({ id: 'V1', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 3 }),
        comp({ id: 'V2', type: 'voltage_source', nodeA: 2, nodeB: 1, value: 2 }),
        comp({ id: 'R1', type: 'resistor', nodeA: 2, nodeB: 0, value: 100 }),
        comp({ id: 'GND', type: 'ground', nodeA: 0, nodeB: 0 }),
      ],
    };
    const result = solveCircuitMNA(config);
    expect(result.success).toBe(true);
    expect(result.nodeVoltages[2]).toBeCloseTo(5, 5);
  });

  it('conflicting voltage sources → singular matrix', () => {
    // Two voltage sources across same nodes with different voltages
    const config: CircuitConfig = {
      nextNodeId: 2,
      components: [
        comp({ id: 'V1', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 5 }),
        comp({ id: 'V2', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 10 }),
        comp({ id: 'GND', type: 'ground', nodeA: 0, nodeB: 0 }),
      ],
    };
    const result = solveCircuitMNA(config);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Singular matrix');
  });

  it('ground node is always 0V', () => {
    const config: CircuitConfig = {
      nextNodeId: 2,
      components: [
        comp({ id: 'V1', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 7 }),
        comp({ id: 'R1', type: 'resistor', nodeA: 1, nodeB: 0, value: 100 }),
        comp({ id: 'GND', type: 'ground', nodeA: 0, nodeB: 0 }),
      ],
    };
    const result = solveCircuitMNA(config);
    expect(result.success).toBe(true);
    expect(result.nodeVoltages[0]).toBe(0);
  });

  it('determinism: two identical solves produce identical results', () => {
    const config: CircuitConfig = {
      nextNodeId: 3,
      components: [
        comp({ id: 'V1', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 5 }),
        comp({ id: 'R1', type: 'resistor', nodeA: 1, nodeB: 2, value: 1000 }),
        comp({ id: 'R2', type: 'resistor', nodeA: 2, nodeB: 0, value: 1000 }),
        comp({ id: 'GND', type: 'ground', nodeA: 0, nodeB: 0 }),
      ],
    };
    const r1 = solveCircuitMNA(config);
    const r2 = solveCircuitMNA(config);

    expect(r1.nodeVoltages).toEqual(r2.nodeVoltages);
    for (let i = 0; i < r1.branchCurrents.length; i++) {
      expect(r1.branchCurrents[i].current).toBe(r2.branchCurrents[i].current);
    }
  });
});
