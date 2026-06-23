import type { StateCreator } from 'zustand';
import type { EditorTool, SimMode, PointCharge } from '../types/simulation';

export interface EditorSlice {
  mode: SimMode;
  activeTool: EditorTool;
  selectedIds: Set<string>;
  clipboard: PointCharge[];
  hiddenIds: Set<string>;
  designName: string;

  setMode: (mode: SimMode) => void;
  setActiveTool: (tool: EditorTool) => void;
  setSelectedIds: (ids: Set<string>) => void;
  addSelectedId: (id: string) => void;
  removeSelectedId: (id: string) => void;
  clearSelection: () => void;
  setClipboard: (charges: PointCharge[]) => void;
  toggleHidden: (id: string) => void;
  showAll: () => void;
  setDesignName: (name: string) => void;

  // Legacy compat
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

export const createEditorSlice: StateCreator<EditorSlice> = (set, get) => ({
  mode: 'field',
  activeTool: 'select',
  selectedIds: new Set<string>(),
  clipboard: [],
  hiddenIds: new Set<string>(),
  designName: 'Untitled Design',

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
  setClipboard: (charges) => set({ clipboard: charges }),
  toggleHidden: (id) => {
    const next = new Set(get().hiddenIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ hiddenIds: next });
  },
  showAll: () => set({ hiddenIds: new Set() }),
  setDesignName: (name) => set({ designName: name || 'Untitled Design' }),

  // Legacy single-selection compat
  get selectedId() {
    const ids = get().selectedIds;
    if (ids.size === 1) return ids.values().next().value!;
    return null;
  },
  setSelectedId: (id) => set({ selectedIds: id ? new Set([id]) : new Set() }),
});
