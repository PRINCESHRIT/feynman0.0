import { describe, it, expect } from 'vitest';
import { solveCircuitMNA } from '../src/solver/circuitSolver';
import type { CircuitConfig, CircuitComponent } from '../src/types/circuit';

function makeComponent(overrides: Partial<CircuitComponent> & { id: string; type: CircuitComponent['type'] }): CircuitComponent {
  return {
    nodeA: 0,
    nodeB: 0,
    value: 0,
    x: 0,
    y: 0,
    rotation: 0,
    ...overrides,
  };
}

describe('Circuit MNA solver (TypeScript)', () => {
  it('resistor divider: two equal resistors give half voltage', () => {
    const config: CircuitConfig = {
      nextNodeId: 3,
      components: [
        makeComponent({ id: 'V1', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 5.0 }),
        makeComponent({ id: 'R1', type: 'resistor', nodeA: 1, nodeB: 2, value: 1000 }),
        makeComponent({ id: 'R2', type: 'resistor', nodeA: 2, nodeB: 0, value: 1000 }),
        makeComponent({ id: 'GND', type: 'ground', nodeA: 0, nodeB: 0 }),
      ],
    };
    const result = solveCircuitMNA(config);
    expect(result.success).toBe(true);

    // Find node 2 voltage (should be 2.5V)
    expect(result.nodeVoltages[2]).toBeCloseTo(2.5, 5);
    // Node 1 should be 5V
    expect(result.nodeVoltages[1]).toBeCloseTo(5, 5);
  });

  it('single resistor: V=IR gives correct current', () => {
    const config: CircuitConfig = {
      nextNodeId: 2,
      components: [
        makeComponent({ id: 'V1', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 10.0 }),
        makeComponent({ id: 'R1', type: 'resistor', nodeA: 1, nodeB: 0, value: 100 }),
        makeComponent({ id: 'GND', type: 'ground', nodeA: 0, nodeB: 0 }),
      ],
    };
    const result = solveCircuitMNA(config);
    expect(result.success).toBe(true);

    const r1Current = result.branchCurrents.find((c) => c.id === 'R1');
    expect(r1Current).toBeDefined();
    expect(r1Current!.current).toBeCloseTo(0.1, 5); // 10V / 100Ω = 0.1A
  });

  it('current source through resistor: V = IR', () => {
    const config: CircuitConfig = {
      nextNodeId: 2,
      components: [
        makeComponent({ id: 'I1', type: 'current_source', nodeA: 0, nodeB: 1, value: 1.0 }),
        makeComponent({ id: 'R1', type: 'resistor', nodeA: 1, nodeB: 0, value: 10 }),
        makeComponent({ id: 'GND', type: 'ground', nodeA: 0, nodeB: 0 }),
      ],
    };
    const result = solveCircuitMNA(config);
    expect(result.success).toBe(true);
    expect(result.nodeVoltages[1]).toBeCloseTo(10, 5); // 1A * 10Ω = 10V
  });

  it('empty circuit solves successfully', () => {
    const config: CircuitConfig = { nextNodeId: 0, components: [] };
    const result = solveCircuitMNA(config);
    expect(result.success).toBe(true);
  });
});
