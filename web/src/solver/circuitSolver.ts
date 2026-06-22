import type { CircuitConfig, CircuitResult } from '../types/circuit';

/**
 * TypeScript reference MNA solver for circuits.
 * Used before WASM worker integration.
 */
export function solveCircuitMNA(config: CircuitConfig): CircuitResult {
  // Find all unique nodes
  const nodeSet = new Set<number>();
  let groundNode = -1;

  for (const comp of config.components) {
    if (comp.type === 'ground') {
      groundNode = comp.nodeA;
    }
    nodeSet.add(comp.nodeA);
    if (comp.type !== 'ground') {
      nodeSet.add(comp.nodeB);
    }
  }

  if (nodeSet.size === 0) {
    return { nodeVoltages: [], branchCurrents: [], success: true };
  }

  if (groundNode === -1) {
    groundNode = Math.min(...nodeSet);
  }

  const nodes = Array.from(nodeSet).sort((a, b) => a - b);
  const n = nodes.length - 1; // exclude ground
  const nodeIdx = (node: number) => {
    if (node === groundNode) return -1;
    const idx = nodes.indexOf(node);
    return idx > nodes.indexOf(groundNode) ? idx - 1 : idx;
  };

  // Count voltage sources
  const vSources = config.components.filter(
    (c) => c.type === 'voltage_source' || c.type === 'wire',
  );
  const m = vSources.length;
  const size = n + m;

  if (size === 0) {
    return { nodeVoltages: [], branchCurrents: [], success: true };
  }

  // Augmented matrix [A | b]
  const matrix: number[][] = Array.from({ length: size }, () =>
    new Array(size + 1).fill(0),
  );

  // Stamp resistors
  for (const comp of config.components) {
    if (comp.type !== 'resistor' || comp.value <= 0) continue;
    const g = 1 / comp.value;
    const i = nodeIdx(comp.nodeA);
    const j = nodeIdx(comp.nodeB);
    if (i >= 0) matrix[i][i] += g;
    if (j >= 0) matrix[j][j] += g;
    if (i >= 0 && j >= 0) {
      matrix[i][j] -= g;
      matrix[j][i] -= g;
    }
  }

  // Stamp current sources
  for (const comp of config.components) {
    if (comp.type !== 'current_source') continue;
    const i = nodeIdx(comp.nodeA);
    const j = nodeIdx(comp.nodeB);
    if (i >= 0) matrix[i][size] -= comp.value;
    if (j >= 0) matrix[j][size] += comp.value;
  }

  // Stamp voltage sources
  vSources.forEach((comp, k) => {
    const col = n + k;
    const voltage = comp.type === 'wire' ? 0 : comp.value;
    const i = nodeIdx(comp.nodeA);
    const j = nodeIdx(comp.nodeB);

    if (i >= 0) {
      matrix[i][col] += 1;
      matrix[col][i] += 1;
    }
    if (j >= 0) {
      matrix[j][col] -= 1;
      matrix[col][j] -= 1;
    }
    matrix[col][size] = voltage;
  });

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < size; col++) {
    let maxRow = col;
    let maxVal = Math.abs(matrix[col][col]);
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(matrix[row][col]) > maxVal) {
        maxVal = Math.abs(matrix[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-15) {
      return {
        nodeVoltages: [],
        branchCurrents: [],
        success: false,
        error: 'Singular matrix — check circuit connectivity',
      };
    }
    [matrix[col], matrix[maxRow]] = [matrix[maxRow], matrix[col]];

    for (let row = col + 1; row < size; row++) {
      const factor = matrix[row][col] / matrix[col][col];
      for (let j = col; j <= size; j++) {
        matrix[row][j] -= factor * matrix[col][j];
      }
    }
  }

  // Back substitution
  const solution = new Array(size).fill(0);
  for (let i = size - 1; i >= 0; i--) {
    let sum = matrix[i][size];
    for (let j = i + 1; j < size; j++) {
      sum -= matrix[i][j] * solution[j];
    }
    solution[i] = sum / matrix[i][i];
  }

  // Extract voltages
  const nodeVoltages = nodes.map((node) => {
    if (node === groundNode) return 0;
    const idx = nodeIdx(node);
    return idx >= 0 ? solution[idx] : 0;
  });

  // Extract currents
  const branchCurrents: Array<{ id: string; current: number }> = [];
  vSources.forEach((comp, k) => {
    branchCurrents.push({ id: comp.id, current: solution[n + k] });
  });
  for (const comp of config.components) {
    if (comp.type === 'resistor' && comp.value > 0) {
      const va = nodeVoltages[nodes.indexOf(comp.nodeA)];
      const vb = nodeVoltages[nodes.indexOf(comp.nodeB)];
      branchCurrents.push({ id: comp.id, current: (va - vb) / comp.value });
    }
  }

  return { nodeVoltages, branchCurrents, success: true };
}
