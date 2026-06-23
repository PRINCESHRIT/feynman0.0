/**
 * Precision & patterning utilities — Phase 3.
 *
 * All operations are pure config transforms (instant).
 * Pattern generation batches into a single solve, not N solves.
 */

import type { PointCharge } from '../types/simulation';
import { generateId } from './id';

// ── F3.2: Alignment ──

export type AlignAxis = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v';

/**
 * Align selected charges along an axis.
 * Single-object align is a no-op (nothing to align to).
 */
export function alignCharges(
  charges: PointCharge[],
  selectedIds: Set<string>,
  axis: AlignAxis,
): PointCharge[] {
  const selected = charges.filter((c) => selectedIds.has(c.id));
  if (selected.length <= 1) return charges; // No-op for single selection

  let target: number;
  switch (axis) {
    case 'left':
      target = Math.min(...selected.map((c) => c.x));
      return charges.map((c) => selectedIds.has(c.id) ? { ...c, x: target } : c);
    case 'right':
      target = Math.max(...selected.map((c) => c.x));
      return charges.map((c) => selectedIds.has(c.id) ? { ...c, x: target } : c);
    case 'top':
      target = Math.min(...selected.map((c) => c.y));
      return charges.map((c) => selectedIds.has(c.id) ? { ...c, y: target } : c);
    case 'bottom':
      target = Math.max(...selected.map((c) => c.y));
      return charges.map((c) => selectedIds.has(c.id) ? { ...c, y: target } : c);
    case 'center-h': {
      const minX = Math.min(...selected.map((c) => c.x));
      const maxX = Math.max(...selected.map((c) => c.x));
      target = Math.round((minX + maxX) / 2);
      return charges.map((c) => selectedIds.has(c.id) ? { ...c, x: target } : c);
    }
    case 'center-v': {
      const minY = Math.min(...selected.map((c) => c.y));
      const maxY = Math.max(...selected.map((c) => c.y));
      target = Math.round((minY + maxY) / 2);
      return charges.map((c) => selectedIds.has(c.id) ? { ...c, y: target } : c);
    }
  }
}

/**
 * Distribute selected charges evenly along an axis.
 * Requires 3+ charges. Handles degenerate (all coincident) gracefully.
 */
export function distributeCharges(
  charges: PointCharge[],
  selectedIds: Set<string>,
  axis: 'horizontal' | 'vertical',
): PointCharge[] {
  const selected = charges.filter((c) => selectedIds.has(c.id));
  if (selected.length < 3) return charges; // Need 3+ to distribute

  const sorted = [...selected].sort((a, b) =>
    axis === 'horizontal' ? a.x - b.x : a.y - b.y,
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const range = axis === 'horizontal' ? last.x - first.x : last.y - first.y;

  // Degenerate: all coincident — no divide-by-zero
  if (range === 0) return charges;

  const step = range / (sorted.length - 1);
  const posMap = new Map<string, number>();
  sorted.forEach((c, i) => {
    const pos = (axis === 'horizontal' ? first.x : first.y) + Math.round(step * i);
    posMap.set(c.id, pos);
  });

  return charges.map((c) => {
    const newPos = posMap.get(c.id);
    if (newPos === undefined) return c;
    return axis === 'horizontal' ? { ...c, x: newPos } : { ...c, y: newPos };
  });
}

// ── F3.3: Duplicate-and-Repeat (patterns) ──

const MAX_PATTERN_COUNT = 50;

export interface PatternConfig {
  count: number; // Number of copies (not including original)
  dx: number;    // X offset per copy
  dy: number;    // Y offset per copy
}

/**
 * Generate a linear pattern of copies.
 * Caps count. Copies landing off-grid are clamped.
 * Returns the new charges to add (not including originals).
 */
export function generatePattern(
  sources: PointCharge[],
  pattern: PatternConfig,
  gridWidth: number,
  gridHeight: number,
): PointCharge[] {
  const count = Math.min(pattern.count, MAX_PATTERN_COUNT);
  if (count <= 0 || sources.length === 0) return [];

  const result: PointCharge[] = [];
  for (let i = 1; i <= count; i++) {
    for (const src of sources) {
      const x = Math.max(0, Math.min(gridWidth - 1, src.x + pattern.dx * i));
      const y = Math.max(0, Math.min(gridHeight - 1, src.y + pattern.dy * i));
      result.push({ ...src, id: generateId(), x, y });
    }
  }
  return result;
}

// ── F3.1: Snap to grid ──

export function snapToGrid(value: number, gridSnap: number): number {
  if (gridSnap <= 1) return Math.round(value);
  return Math.round(value / gridSnap) * gridSnap;
}
