import type { StateCreator } from 'zustand';
import type { Run, FieldConfig, SolveResult, SimMode } from '../types/simulation';
import type { CircuitConfig, CircuitResult } from '../types/circuit';
import { generateId } from '../utils/id';

export interface RunTreeSlice {
  runs: Map<string, Run>;
  activeRunId: string | null;
  getActiveRun: () => Run | undefined;
  createRun: (config: FieldConfig, mode?: SimMode) => string;
  createCircuitRun: (circuitConfig: CircuitConfig) => string;
  forkRun: (parentId: string, configChanges: Partial<FieldConfig>) => string;
  forkCircuitRun: (parentId: string, circuitChanges: Partial<CircuitConfig>) => string;
  updateResult: (runId: string, result: SolveResult) => void;
  updateCircuitResult: (runId: string, result: CircuitResult) => void;
  setActiveRun: (id: string) => void;
  labelRun: (id: string, label: string) => void;
  deleteRun: (id: string) => void;
}

const defaultFieldConfig: FieldConfig = {
  grid: { width: 128, height: 128 },
  charges: [],
  boundary: { type: 'dirichlet_zero' },
  engine: 'gauss_seidel',
  maxIterations: 10000,
  tolerance: 1e-6,
};

export const createRunTreeSlice: StateCreator<RunTreeSlice> = (set, get) => {
  const initialId = generateId();
  const initialRun: Run = {
    id: initialId,
    parentId: null,
    mode: 'field',
    config: defaultFieldConfig,
    result: null,
    label: 'Initial',
    createdAt: Date.now(),
  };

  return {
    runs: new Map([[initialId, initialRun]]),
    activeRunId: initialId,

    getActiveRun: () => {
      const { runs, activeRunId } = get();
      return activeRunId ? runs.get(activeRunId) : undefined;
    },

    createRun: (config, mode = 'field') => {
      const id = generateId();
      const run: Run = {
        id,
        parentId: null,
        mode,
        config,
        result: null,
        label: `Run ${id.slice(0, 4)}`,
        createdAt: Date.now(),
      };
      set((state) => {
        const runs = new Map(state.runs);
        runs.set(id, run);
        return { runs, activeRunId: id };
      });
      return id;
    },

    createCircuitRun: (circuitConfig) => {
      const id = generateId();
      const run: Run = {
        id,
        parentId: null,
        mode: 'circuit',
        config: defaultFieldConfig, // placeholder, not used for circuit
        circuitConfig,
        circuitResult: null,
        result: null,
        label: `Circuit ${id.slice(0, 4)}`,
        createdAt: Date.now(),
      };
      set((state) => {
        const runs = new Map(state.runs);
        runs.set(id, run);
        return { runs, activeRunId: id };
      });
      return id;
    },

    forkRun: (parentId, configChanges) => {
      const parent = get().runs.get(parentId);
      if (!parent) throw new Error(`Run ${parentId} not found`);

      const id = generateId();
      const run: Run = {
        id,
        parentId,
        mode: parent.mode,
        config: { ...parent.config, ...configChanges },
        result: null,
        label: `Fork of ${parent.label}`,
        createdAt: Date.now(),
      };
      set((state) => {
        const runs = new Map(state.runs);
        runs.set(id, run);
        return { runs, activeRunId: id };
      });
      return id;
    },

    forkCircuitRun: (parentId, circuitChanges) => {
      const parent = get().runs.get(parentId);
      if (!parent) throw new Error(`Run ${parentId} not found`);

      const id = generateId();
      const run: Run = {
        id,
        parentId,
        mode: 'circuit',
        config: parent.config,
        circuitConfig: { ...parent.circuitConfig!, ...circuitChanges },
        circuitResult: null,
        result: null,
        label: `Fork of ${parent.label}`,
        createdAt: Date.now(),
      };
      set((state) => {
        const runs = new Map(state.runs);
        runs.set(id, run);
        return { runs, activeRunId: id };
      });
      return id;
    },

    updateResult: (runId, result) => {
      set((state) => {
        const run = state.runs.get(runId);
        if (!run) return state;
        const runs = new Map(state.runs);
        runs.set(runId, { ...run, result });
        return { runs };
      });
    },

    updateCircuitResult: (runId, result) => {
      set((state) => {
        const run = state.runs.get(runId);
        if (!run) return state;
        const runs = new Map(state.runs);
        runs.set(runId, { ...run, circuitResult: result });
        return { runs };
      });
    },

    setActiveRun: (id) => set({ activeRunId: id }),

    labelRun: (id, label) => {
      set((state) => {
        const run = state.runs.get(id);
        if (!run) return state;
        const runs = new Map(state.runs);
        runs.set(id, { ...run, label });
        return { runs };
      });
    },

    deleteRun: (id) => {
      set((state) => {
        const runs = new Map(state.runs);
        runs.delete(id);
        const activeRunId = state.activeRunId === id
          ? (runs.keys().next().value ?? null)
          : state.activeRunId;
        return { runs, activeRunId };
      });
    },
  };
};
