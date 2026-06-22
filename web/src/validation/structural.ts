import type { FieldConfig } from '../types/simulation';
import type { Conflict } from '../types/conflicts';

/**
 * Structural validators — run synchronously on every config change.
 */
export function validateStructural(config: FieldConfig): Conflict[] {
  const conflicts: Conflict[] = [];
  const { width, height } = config.grid;

  // Check charges in bounds
  for (const charge of config.charges) {
    if (charge.x < 0 || charge.x >= width || charge.y < 0 || charge.y >= height) {
      conflicts.push({
        id: `oob-${charge.id}`,
        type: 'structural',
        severity: 'error',
        message: `Charge at (${charge.x}, ${charge.y}) is out of bounds (grid: ${width}×${height})`,
        relatedIds: [charge.id],
      });
    }
  }

  // Check for overlapping charges
  const positions = new Map<string, string[]>();
  for (const charge of config.charges) {
    const key = `${charge.x},${charge.y}`;
    const ids = positions.get(key) ?? [];
    ids.push(charge.id);
    positions.set(key, ids);
  }
  for (const [pos, ids] of positions) {
    if (ids.length > 1) {
      conflicts.push({
        id: `overlap-${pos}`,
        type: 'structural',
        severity: 'warning',
        message: `${ids.length} charges overlap at (${pos})`,
        relatedIds: ids,
      });
    }
  }

  // Check charge on boundary (reduced accuracy)
  for (const charge of config.charges) {
    if (charge.x === 0 || charge.x === width - 1 || charge.y === 0 || charge.y === height - 1) {
      conflicts.push({
        id: `boundary-${charge.id}`,
        type: 'structural',
        severity: 'warning',
        message: `Charge at (${charge.x}, ${charge.y}) is on the boundary — will be overwritten by BC`,
        relatedIds: [charge.id],
      });
    }
  }

  // Check zero-magnitude charges
  for (const charge of config.charges) {
    if (charge.q === 0) {
      conflicts.push({
        id: `zero-${charge.id}`,
        type: 'structural',
        severity: 'info',
        message: `Charge at (${charge.x}, ${charge.y}) has zero magnitude`,
        relatedIds: [charge.id],
      });
    }
  }

  // Check grid size valid
  if (width < 3 || height < 3) {
    conflicts.push({
      id: 'grid-small',
      type: 'structural',
      severity: 'error',
      message: `Grid too small (${width}×${height}). Minimum is 3×3.`,
      relatedIds: [],
    });
  }

  return conflicts;
}
