import type { StateCreator } from 'zustand';
import type { EditorTool, SimMode } from '../types/simulation';

export interface EditorSlice {
  mode: SimMode;
  activeTool: EditorTool;
  selectedIds: Set<string>;
  setMode: (mode: SimMode) => void;
  setActiveTool: (tool: EditorTool) => void;
  setSelectedIds: (ids: Set<string>) => void;
  addSelectedId: (id: string) => void;
  removeSelectedId: (id: string) => void;
  clearSelection: () => void;
  // Legacy compat
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

export const createEditorSlice: StateCreator<EditorSlice> = (set, get) => ({
  mode: 'field',
  activeTool: 'select',
  selectedIds: new Set<string>(),
  setMode: (mode) => set({ mode }),
  setActiveTool: (tool) => set({ activeTool: tool, selectedIds: new Set() }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  addSelectedId: (id) => {
    const next = new Set(get().selectedIds);
    next.add(id);
    set({ selectedIds: next });
  },
  removeSelectedId: (id) => {
    const next = new Set(get().selectedIds);
    next.delete(id);
    set({ selectedIds: next });
  },
  clearSelection: () => set({ selectedIds: new Set() }),

  // Legacy single-selection compat
  get selectedId() {
    const ids = get().selectedIds;
    if (ids.size === 1) return ids.values().next().value!;
    return null;
  },
  setSelectedId: (id) => set({ selectedIds: id ? new Set([id]) : new Set() }),
});
