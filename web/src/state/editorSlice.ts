import type { StateCreator } from 'zustand';
import type { EditorTool, SimMode } from '../types/simulation';

export interface EditorSlice {
  mode: SimMode;
  activeTool: EditorTool;
  selectedId: string | null;
  setMode: (mode: SimMode) => void;
  setActiveTool: (tool: EditorTool) => void;
  setSelectedId: (id: string | null) => void;
}

export const createEditorSlice: StateCreator<EditorSlice> = (set) => ({
  mode: 'field',
  activeTool: 'select',
  selectedId: null,
  setMode: (mode) => set({ mode }),
  setActiveTool: (tool) => set({ activeTool: tool, selectedId: null }),
  setSelectedId: (id) => set({ selectedId: id }),
});
