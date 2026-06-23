/**
 * Command stack for undo/redo — Phase 2.
 *
 * Architectural rule: This is a mutable working config stack, NOT the run tree.
 * A "run" is a committed, solved, persisted snapshot. The command stack tracks
 * edits to the working config between commits.
 *
 * Each command stores the previous and next config for the active run.
 * Undo restores the previous config; redo restores the next.
 * A single re-solve is batched after multi-step undo (not one per step).
 */

import type { FieldConfig } from '../types/simulation';

export interface Command {
  description: string;
  prevConfig: FieldConfig;
  nextConfig: FieldConfig;
}

const MAX_STACK = 100;

let undoStack: Command[] = [];
let redoStack: Command[] = [];

export function pushCommand(cmd: Command) {
  undoStack.push(cmd);
  if (undoStack.length > MAX_STACK) undoStack.shift();
  // Any new command clears the redo stack
  redoStack = [];
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

export function undo(): FieldConfig | null {
  const cmd = undoStack.pop();
  if (!cmd) return null;
  redoStack.push(cmd);
  return cmd.prevConfig;
}

export function redo(): FieldConfig | null {
  const cmd = redoStack.pop();
  if (!cmd) return null;
  undoStack.push(cmd);
  return cmd.nextConfig;
}

export function clearStack() {
  undoStack = [];
  redoStack = [];
}

export function getUndoCount(): number {
  return undoStack.length;
}

export function getRedoCount(): number {
  return redoStack.length;
}
