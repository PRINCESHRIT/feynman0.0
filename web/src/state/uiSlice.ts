import type { StateCreator } from 'zustand';

export interface Viewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export interface UiSlice {
  showEquipotentials: boolean;
  showVectors: boolean;
  showGrid: boolean;
  viewport: Viewport;
  resolution: number;
  diffMode: boolean;
  diffRunIdA: string | null;
  diffRunIdB: string | null;
  toggleEquipotentials: () => void;
  toggleVectors: () => void;
  toggleGrid: () => void;
  setViewport: (viewport: Viewport) => void;
  setResolution: (res: number) => void;
  setDiffMode: (on: boolean) => void;
  setDiffRuns: (idA: string, idB: string) => void;
}

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  showEquipotentials: true,
  showVectors: false,
  showGrid: true,
  viewport: { offsetX: 0, offsetY: 0, scale: 1 },
  resolution: 128,
  diffMode: false,
  diffRunIdA: null,
  diffRunIdB: null,
  toggleEquipotentials: () => set((s) => ({ showEquipotentials: !s.showEquipotentials })),
  toggleVectors: () => set((s) => ({ showVectors: !s.showVectors })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setViewport: (viewport) => set({ viewport }),
  setResolution: (resolution) => set({ resolution }),
  setDiffMode: (diffMode) => set({ diffMode }),
  setDiffRuns: (diffRunIdA, diffRunIdB) => set({ diffRunIdA, diffRunIdB, diffMode: true }),
});
