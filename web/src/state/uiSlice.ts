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
  toggleEquipotentials: () => void;
  toggleVectors: () => void;
  toggleGrid: () => void;
  setViewport: (viewport: Viewport) => void;
  setResolution: (res: number) => void;
}

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  showEquipotentials: true,
  showVectors: false,
  showGrid: true,
  viewport: { offsetX: 0, offsetY: 0, scale: 1 },
  resolution: 128,
  toggleEquipotentials: () => set((s) => ({ showEquipotentials: !s.showEquipotentials })),
  toggleVectors: () => set((s) => ({ showVectors: !s.showVectors })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setViewport: (viewport) => set({ viewport }),
  setResolution: (resolution) => set({ resolution }),
});
