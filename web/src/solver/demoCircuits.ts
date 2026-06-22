import type { CircuitConfig, CircuitComponent } from '../types/circuit';

/**
 * Pre-built demo circuits for testing circuit mode.
 */

export function resistorDividerDemo(): CircuitConfig {
  // Classic voltage divider: 10V source, R1=1kΩ, R2=2kΩ
  // Expected: V_mid = 10 * 2000/(1000+2000) = 6.667V
  return {
    nextNodeId: 4,
    components: [
      { id: 'GND', type: 'ground', nodeA: 0, nodeB: 0, value: 0, x: 300, y: 400, rotation: 0 },
      { id: 'V1', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 10.0, x: 100, y: 250, rotation: 0 },
      { id: 'R1', type: 'resistor', nodeA: 1, nodeB: 2, value: 1000, x: 300, y: 100, rotation: 0 },
      { id: 'R2', type: 'resistor', nodeA: 2, nodeB: 0, value: 2000, x: 300, y: 250, rotation: 0 },
      { id: 'W1', type: 'wire', nodeA: 1, nodeB: 1, value: 0, x: 200, y: 50, rotation: 0 },
    ],
  };
}

export function wheatstoneDemo(): CircuitConfig {
  // Wheatstone bridge: V=12V, R1=R2=R3=R4=100Ω
  // Balanced bridge → V across bridge = 0
  return {
    nextNodeId: 5,
    components: [
      { id: 'GND', type: 'ground', nodeA: 0, nodeB: 0, value: 0, x: 300, y: 500, rotation: 0 },
      { id: 'V1', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 12.0, x: 50, y: 250, rotation: 0 },
      { id: 'R1', type: 'resistor', nodeA: 1, nodeB: 2, value: 100, x: 200, y: 100, rotation: 0 },
      { id: 'R2', type: 'resistor', nodeA: 1, nodeB: 3, value: 100, x: 200, y: 300, rotation: 0 },
      { id: 'R3', type: 'resistor', nodeA: 2, nodeB: 0, value: 100, x: 400, y: 100, rotation: 0 },
      { id: 'R4', type: 'resistor', nodeA: 3, nodeB: 0, value: 100, x: 400, y: 300, rotation: 0 },
      { id: 'R_bridge', type: 'resistor', nodeA: 2, nodeB: 3, value: 1000, x: 300, y: 200, rotation: 90 },
    ],
  };
}

export function seriesParallelDemo(): CircuitConfig {
  // 5V source, R1=100Ω in series with R2||R3 (200Ω each → 100Ω parallel)
  // Total = 200Ω, I = 25mA, V_mid = 2.5V
  return {
    nextNodeId: 4,
    components: [
      { id: 'GND', type: 'ground', nodeA: 0, nodeB: 0, value: 0, x: 300, y: 400, rotation: 0 },
      { id: 'V1', type: 'voltage_source', nodeA: 1, nodeB: 0, value: 5.0, x: 50, y: 200, rotation: 0 },
      { id: 'R1', type: 'resistor', nodeA: 1, nodeB: 2, value: 100, x: 250, y: 80, rotation: 0 },
      { id: 'R2', type: 'resistor', nodeA: 2, nodeB: 0, value: 200, x: 350, y: 200, rotation: 0 },
      { id: 'R3', type: 'resistor', nodeA: 2, nodeB: 0, value: 200, x: 500, y: 200, rotation: 0 },
    ],
  };
}

export const DEMO_CIRCUITS = [
  { name: 'Voltage Divider (10V, 1kΩ/2kΩ)', factory: resistorDividerDemo },
  { name: 'Wheatstone Bridge (12V, balanced)', factory: wheatstoneDemo },
  { name: 'Series-Parallel (5V, 100Ω + 200Ω||200Ω)', factory: seriesParallelDemo },
];
