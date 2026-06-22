import { create } from 'zustand';
import { createEditorSlice, type EditorSlice } from './editorSlice';
import { createSolverSlice, type SolverSlice } from './solverSlice';
import { createRunTreeSlice, type RunTreeSlice } from './runTreeSlice';
import { createUiSlice, type UiSlice } from './uiSlice';

export type AppStore = EditorSlice & SolverSlice & RunTreeSlice & UiSlice;

export const useStore = create<AppStore>()((...a) => ({
  ...createEditorSlice(...a),
  ...createSolverSlice(...a),
  ...createRunTreeSlice(...a),
  ...createUiSlice(...a),
}));
