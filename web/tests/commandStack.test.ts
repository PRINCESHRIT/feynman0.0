/**
 * Command Stack Tests — Phase 2.
 *
 * Key architectural invariant: command stack is mutable working config,
 * NOT the run tree. Undo/redo here does NOT change activeRunId.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  pushCommand,
  undo,
  redo,
  canUndo,
  canRedo,
  clearStack,
  getUndoCount,
  getRedoCount,
} from '../src/state/commandStack';
import type { FieldConfig } from '../src/types/simulation';

function makeConfig(charges: Array<{ id: string; q: number }>): FieldConfig {
  return {
    grid: { width: 33, height: 33 },
    charges: charges.map((c) => ({ ...c, x: 16, y: 16 })),
    boundary: { type: 'dirichlet_zero' },
    engine: 'gauss_seidel',
    maxIterations: 1000,
    tolerance: 1e-6,
  };
}

describe('Command Stack', () => {
  beforeEach(() => {
    clearStack();
  });

  it('starts empty — canUndo/canRedo false', () => {
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
    expect(getUndoCount()).toBe(0);
    expect(getRedoCount()).toBe(0);
  });

  it('push makes canUndo true, canRedo still false', () => {
    const prev = makeConfig([]);
    const next = makeConfig([{ id: 'q1', q: 1 }]);
    pushCommand({ description: 'Add charge', prevConfig: prev, nextConfig: next });

    expect(canUndo()).toBe(true);
    expect(canRedo()).toBe(false);
    expect(getUndoCount()).toBe(1);
  });

  it('undo returns prevConfig and enables redo', () => {
    const prev = makeConfig([]);
    const next = makeConfig([{ id: 'q1', q: 1 }]);
    pushCommand({ description: 'Add charge', prevConfig: prev, nextConfig: next });

    const undone = undo();
    expect(undone).toBe(prev);
    expect(canRedo()).toBe(true);
    expect(canUndo()).toBe(false);
  });

  it('redo returns nextConfig and re-enables undo', () => {
    const prev = makeConfig([]);
    const next = makeConfig([{ id: 'q1', q: 1 }]);
    pushCommand({ description: 'Add charge', prevConfig: prev, nextConfig: next });

    undo();
    const redone = redo();
    expect(redone).toBe(next);
    expect(canUndo()).toBe(true);
    expect(canRedo()).toBe(false);
  });

  it('undo on empty stack returns null', () => {
    expect(undo()).toBeNull();
  });

  it('redo on empty stack returns null', () => {
    expect(redo()).toBeNull();
  });

  it('new push after undo clears redo stack', () => {
    const c0 = makeConfig([]);
    const c1 = makeConfig([{ id: 'q1', q: 1 }]);
    const c2 = makeConfig([{ id: 'q1', q: 2 }]);

    pushCommand({ description: 'Add', prevConfig: c0, nextConfig: c1 });
    undo(); // redo stack has 1
    expect(canRedo()).toBe(true);

    pushCommand({ description: 'Change q', prevConfig: c0, nextConfig: c2 });
    expect(canRedo()).toBe(false); // redo cleared
    expect(canUndo()).toBe(true);
  });

  it('multi-step undo/redo sequence', () => {
    const c0 = makeConfig([]);
    const c1 = makeConfig([{ id: 'q1', q: 1 }]);
    const c2 = makeConfig([{ id: 'q1', q: 2 }]);
    const c3 = makeConfig([{ id: 'q1', q: 3 }]);

    pushCommand({ description: 'Step 1', prevConfig: c0, nextConfig: c1 });
    pushCommand({ description: 'Step 2', prevConfig: c1, nextConfig: c2 });
    pushCommand({ description: 'Step 3', prevConfig: c2, nextConfig: c3 });

    expect(getUndoCount()).toBe(3);

    // Undo all 3
    expect(undo()).toBe(c2);
    expect(undo()).toBe(c1);
    expect(undo()).toBe(c0);
    expect(canUndo()).toBe(false);
    expect(getRedoCount()).toBe(3);

    // Redo all 3
    expect(redo()).toBe(c1);
    expect(redo()).toBe(c2);
    expect(redo()).toBe(c3);
    expect(canRedo()).toBe(false);
  });

  it('stack caps at 100 commands', () => {
    for (let i = 0; i < 120; i++) {
      pushCommand({
        description: `Step ${i}`,
        prevConfig: makeConfig([{ id: 'q1', q: i }]),
        nextConfig: makeConfig([{ id: 'q1', q: i + 1 }]),
      });
    }

    expect(getUndoCount()).toBe(100);
  });

  it('clearStack resets everything', () => {
    pushCommand({
      description: 'Test',
      prevConfig: makeConfig([]),
      nextConfig: makeConfig([{ id: 'q1', q: 1 }]),
    });
    undo();

    expect(canRedo()).toBe(true);
    clearStack();
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
    expect(getUndoCount()).toBe(0);
    expect(getRedoCount()).toBe(0);
  });

  it('undo does NOT return a run ID — it returns a config (architectural invariant)', () => {
    const prev = makeConfig([]);
    const next = makeConfig([{ id: 'q1', q: 1 }]);
    pushCommand({ description: 'Add', prevConfig: prev, nextConfig: next });

    const result = undo();
    // The result is a FieldConfig, not a run ID or run object
    expect(result).toHaveProperty('grid');
    expect(result).toHaveProperty('charges');
    expect(result).toHaveProperty('boundary');
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('parentId');
  });
});
