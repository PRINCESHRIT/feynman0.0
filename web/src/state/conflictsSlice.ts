import type { StateCreator } from 'zustand';
import type { Conflict } from '../types/conflicts';

export interface ConflictsSlice {
  conflicts: Conflict[];
  setConflicts: (conflicts: Conflict[]) => void;
  addConflict: (conflict: Conflict) => void;
  clearConflicts: (type?: 'structural' | 'numerical') => void;
}

export const createConflictsSlice: StateCreator<ConflictsSlice> = (set) => ({
  conflicts: [],
  setConflicts: (conflicts) => set({ conflicts }),
  addConflict: (conflict) => set((s) => ({ conflicts: [...s.conflicts, conflict] })),
  clearConflicts: (type) => set((s) => ({
    conflicts: type ? s.conflicts.filter((c) => c.type !== type) : [],
  })),
});
