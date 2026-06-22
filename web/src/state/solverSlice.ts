import type { StateCreator } from 'zustand';
import type { SolverProgress, SolverStatus, SolveResult } from '../types/simulation';

export interface SolverSlice {
  solverStatus: SolverStatus;
  solverProgress: SolverProgress | null;
  solveResult: SolveResult | null;
  setSolverStatus: (status: SolverStatus) => void;
  setSolverProgress: (progress: SolverProgress | null) => void;
  setSolveResult: (result: SolveResult | null) => void;
}

export const createSolverSlice: StateCreator<SolverSlice> = (set) => ({
  solverStatus: 'idle',
  solverProgress: null,
  solveResult: null,
  setSolverStatus: (status) => set({ solverStatus: status }),
  setSolverProgress: (progress) => set({ solverProgress: progress }),
  setSolveResult: (result) => set({ solveResult: result }),
});
