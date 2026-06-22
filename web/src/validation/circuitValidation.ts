import type { CircuitConfig } from '../types/circuit';
import type { Conflict } from '../types/conflicts';

/**
 * Structural validators for circuit mode.
 */
export function validateCircuit(config: CircuitConfig): Conflict[] {
  const conflicts: Conflict[] = [];

  if (config.components.length === 0) return conflicts;

  // Check for ground
  const hasGround = config.components.some((c) => c.type === 'ground');
  if (!hasGround) {
    conflicts.push({
      id: 'no-ground',
      type: 'structural',
      severity: 'error',
      message: 'Circuit has no ground node — add a ground component',
      relatedIds: [],
    });
  }

  // Short circuit detection (voltage source across wire or zero-resistance path)
  // Simple check: two voltage sources with same nodes
  const vSources = config.components.filter((c) => c.type === 'voltage_source');
  for (let i = 0; i < vSources.length; i++) {
    for (let j = i + 1; j < vSources.length; j++) {
      const a = vSources[i];
      const b = vSources[j];
      if (
        (a.nodeA === b.nodeA && a.nodeB === b.nodeB) ||
        (a.nodeA === b.nodeB && a.nodeB === b.nodeA)
      ) {
        if (a.value !== b.value) {
          conflicts.push({
            id: `conflicting-vsource-${a.id}-${b.id}`,
            type: 'structural',
            severity: 'error',
            message: `Conflicting voltage sources ${a.id} and ${b.id} on same nodes`,
            relatedIds: [a.id, b.id],
          });
        }
      }
    }
  }

  // Floating nodes (nodes connected to only one component)
  const nodeDegree = new Map<number, string[]>();
  for (const comp of config.components) {
    if (comp.type === 'ground') {
      const ids = nodeDegree.get(comp.nodeA) ?? [];
      ids.push(comp.id);
      nodeDegree.set(comp.nodeA, ids);
      continue;
    }
    for (const node of [comp.nodeA, comp.nodeB]) {
      const ids = nodeDegree.get(node) ?? [];
      ids.push(comp.id);
      nodeDegree.set(node, ids);
    }
  }
  for (const [node, ids] of nodeDegree) {
    if (ids.length < 2) {
      conflicts.push({
        id: `floating-node-${node}`,
        type: 'structural',
        severity: 'warning',
        message: `Node ${node} is only connected to one component — may be floating`,
        relatedIds: ids,
      });
    }
  }

  // Zero or negative resistance
  for (const comp of config.components) {
    if (comp.type === 'resistor' && comp.value <= 0) {
      conflicts.push({
        id: `invalid-resistance-${comp.id}`,
        type: 'structural',
        severity: 'error',
        message: `Resistor ${comp.id} has invalid resistance (${comp.value}Ω)`,
        relatedIds: [comp.id],
      });
    }
  }

  return conflicts;
}
