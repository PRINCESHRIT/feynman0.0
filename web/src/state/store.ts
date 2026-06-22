import { create } from 'zustand';
import { createEditorSlice, type EditorSlice } from './editorSlice';
import { createSolverSlice, type SolverSlice } from './solverSlice';
import { createRunTreeSlice, type RunTreeSlice } from './runTreeSlice';
import { createUiSlice, type UiSlice } from './uiSlice';
import { createConflictsSlice, type ConflictsSlice } from './conflictsSlice';

export type AppStore = EditorSlice & SolverSlice & RunTreeSlice & UiSlice & ConflictsSlice;

export const useStore = create<AppStore>()((...a) => ({
  ...createEditorSlice(...a),
  ...createSolverSlice(...a),
  ...createRunTreeSlice(...a),
  ...createUiSlice(...a),
  ...createConflictsSlice(...a),
}));
