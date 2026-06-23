/**
 * Precision & Patterning Tests — Phase 3.
 *
 * Tests alignment, distribution, pattern generation, and grid snap.
 * All operations are pure config transforms (no solving).
 */

import { describe, it, expect } from 'vitest';
import {
  alignCharges,
  distributeCharges,
  generatePattern,
  snapToGrid,
} from '../src/utils/precision';
import type { PointCharge } from '../src/types/simulation';

function charge(id: string, x: number, y: number, q = 1): PointCharge {
  return { id, x, y, q };
}

describe('alignCharges', () => {
  const charges = [
    charge('a', 5, 10),
    charge('b', 15, 20),
    charge('c', 10, 30),
    charge('d', 25, 5), // unselected
  ];
  const selected = new Set(['a', 'b', 'c']);

  it('align left — all selected x = min(x)', () => {
    const result = alignCharges(charges, selected, 'left');
    expect(result.find((c) => c.id === 'a')!.x).toBe(5);
    expect(result.find((c) => c.id === 'b')!.x).toBe(5);
    expect(result.find((c) => c.id === 'c')!.x).toBe(5);
    expect(result.find((c) => c.id === 'd')!.x).toBe(25); // untouched
  });

  it('align right — all selected x = max(x)', () => {
    const result = alignCharges(charges, selected, 'right');
    expect(result.find((c) => c.id === 'a')!.x).toBe(15);
    expect(result.find((c) => c.id === 'b')!.x).toBe(15);
    expect(result.find((c) => c.id === 'c')!.x).toBe(15);
  });

  it('align top — all selected y = min(y)', () => {
    const result = alignCharges(charges, selected, 'top');
    expect(result.find((c) => c.id === 'a')!.y).toBe(10);
    expect(result.find((c) => c.id === 'b')!.y).toBe(10);
    expect(result.find((c) => c.id === 'c')!.y).toBe(10);
  });

  it('align bottom — all selected y = max(y)', () => {
    const result = alignCharges(charges, selected, 'bottom');
    expect(result.find((c) => c.id === 'a')!.y).toBe(30);
    expect(result.find((c) => c.id === 'b')!.y).toBe(30);
    expect(result.find((c) => c.id === 'c')!.y).toBe(30);
  });

  it('align center-h — all selected x = round(avg of min and max x)', () => {
    const result = alignCharges(charges, selected, 'center-h');
    const expected = Math.round((5 + 15) / 2); // 10
    expect(result.find((c) => c.id === 'a')!.x).toBe(expected);
    expect(result.find((c) => c.id === 'b')!.x).toBe(expected);
    expect(result.find((c) => c.id === 'c')!.x).toBe(expected);
  });

  it('align center-v — all selected y = round(avg of min and max y)', () => {
    const result = alignCharges(charges, selected, 'center-v');
    const expected = Math.round((10 + 30) / 2); // 20
    expect(result.find((c) => c.id === 'a')!.y).toBe(expected);
    expect(result.find((c) => c.id === 'b')!.y).toBe(expected);
    expect(result.find((c) => c.id === 'c')!.y).toBe(expected);
  });

  it('single selection is a no-op', () => {
    const result = alignCharges(charges, new Set(['a']), 'left');
    expect(result).toEqual(charges); // returns original
  });
});

describe('distributeCharges', () => {
  it('distributes 3 charges evenly horizontally', () => {
    const charges = [
      charge('a', 0, 10),
      charge('b', 20, 10),
      charge('c', 5, 10), // out of order
    ];
    const selected = new Set(['a', 'b', 'c']);
    const result = distributeCharges(charges, selected, 'horizontal');

    // Sorted: a(0), c(5), b(20) → step = 20/2 = 10
    // a: 0, c: 10, b: 20
    expect(result.find((c) => c.id === 'a')!.x).toBe(0);
    expect(result.find((c) => c.id === 'c')!.x).toBe(10);
    expect(result.find((c) => c.id === 'b')!.x).toBe(20);
  });

  it('distributes 4 charges evenly vertically', () => {
    const charges = [
      charge('a', 10, 0),
      charge('b', 10, 30),
      charge('c', 10, 25),
      charge('d', 10, 5),
    ];
    const selected = new Set(['a', 'b', 'c', 'd']);
    const result = distributeCharges(charges, selected, 'vertical');

    // Sorted by y: a(0), d(5), c(25), b(30) → step = 30/3 = 10
    expect(result.find((c) => c.id === 'a')!.y).toBe(0);
    expect(result.find((c) => c.id === 'd')!.y).toBe(10);
    expect(result.find((c) => c.id === 'c')!.y).toBe(20);
    expect(result.find((c) => c.id === 'b')!.y).toBe(30);
  });

  it('fewer than 3 charges returns original', () => {
    const charges = [charge('a', 0, 0), charge('b', 10, 10)];
    const result = distributeCharges(charges, new Set(['a', 'b']), 'horizontal');
    expect(result).toEqual(charges);
  });

  it('all coincident charges (degenerate) returns original', () => {
    const charges = [
      charge('a', 5, 5),
      charge('b', 5, 5),
      charge('c', 5, 5),
    ];
    const result = distributeCharges(charges, new Set(['a', 'b', 'c']), 'horizontal');
    expect(result).toEqual(charges);
  });
});

describe('generatePattern', () => {
  it('generates N copies with offset', () => {
    const sources = [charge('src', 5, 5)];
    const result = generatePattern(sources, { count: 3, dx: 2, dy: 0 }, 33, 33);

    expect(result.length).toBe(3);
    expect(result[0].x).toBe(7);
    expect(result[1].x).toBe(9);
    expect(result[2].x).toBe(11);
    // All have unique IDs
    const ids = new Set(result.map((c) => c.id));
    expect(ids.size).toBe(3);
    // None has the source ID
    expect(ids.has('src')).toBe(false);
  });

  it('clamps off-grid copies', () => {
    const sources = [charge('src', 30, 30)];
    const result = generatePattern(sources, { count: 3, dx: 5, dy: 5 }, 33, 33);

    expect(result.length).toBe(3);
    // All clamped to grid bounds
    for (const c of result) {
      expect(c.x).toBeLessThanOrEqual(32);
      expect(c.y).toBeLessThanOrEqual(32);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('caps at MAX_PATTERN_COUNT (50)', () => {
    const sources = [charge('src', 5, 5)];
    const result = generatePattern(sources, { count: 100, dx: 1, dy: 0 }, 200, 200);
    expect(result.length).toBe(50);
  });

  it('zero count returns empty', () => {
    const sources = [charge('src', 5, 5)];
    expect(generatePattern(sources, { count: 0, dx: 1, dy: 0 }, 33, 33)).toEqual([]);
  });

  it('empty sources returns empty', () => {
    expect(generatePattern([], { count: 3, dx: 1, dy: 0 }, 33, 33)).toEqual([]);
  });

  it('multiple sources generate count*sources.length copies', () => {
    const sources = [charge('a', 5, 5), charge('b', 10, 10)];
    const result = generatePattern(sources, { count: 2, dx: 1, dy: 1 }, 33, 33);
    expect(result.length).toBe(4); // 2 sources * 2 copies
  });
});

describe('snapToGrid', () => {
  it('snap=1 rounds to nearest integer', () => {
    expect(snapToGrid(2.3, 1)).toBe(2);
    expect(snapToGrid(2.7, 1)).toBe(3);
    expect(snapToGrid(2.5, 1)).toBe(3); // Math.round rounds .5 up
  });

  it('snap=5 rounds to nearest multiple of 5', () => {
    expect(snapToGrid(7, 5)).toBe(5);
    expect(snapToGrid(8, 5)).toBe(10);
    expect(snapToGrid(12, 5)).toBe(10);
    expect(snapToGrid(13, 5)).toBe(15);
  });

  it('snap=0 or snap=1 behaves the same (just round)', () => {
    expect(snapToGrid(2.3, 0)).toBe(2);
    expect(snapToGrid(2.3, 1)).toBe(2);
  });

  it('negative values snap correctly', () => {
    expect(snapToGrid(-2.3, 5)).toBeCloseTo(0, 10); // -0 ≈ 0
    expect(snapToGrid(-7, 5)).toBe(-5);
  });
});
