// ── Grid & Geometry ──

export interface GridConfig {
  width: number;
  height: number;
}

// ── Charges ──

export interface PointCharge {
  id: string;
  x: number;
  y: number;
  q: number;
}

// ── Boundary Conditions ──

export type BoundaryCondition =
  | { type: 'dirichlet_zero' }
  | { type: 'dirichlet_fixed'; voltages: [number, number, number, number] } // [top, right, bottom, left]
  | { type: 'neumann' };

// ── Solver Engine ──

export type FieldEngineType = 'jacobi' | 'gauss_seidel' | 'sor';

// ── Field Configuration ──

export interface FieldConfig {
  grid: GridConfig;
  charges: PointCharge[];
  boundary: BoundaryCondition;
  engine: FieldEngineType;
  maxIterations: number;
  tolerance: number;
}

// ── Solve Result ──

export interface SolveResult {
  potential: Float32Array;
  width: number;
  height: number;
  iterations: number;
  residual: number;
  converged: boolean;
  timeMs: number;
}

// ── Run Tree ──

export type SimMode = 'field' | 'circuit';

export interface Run {
  id: string;
  parentId: string | null;
  mode: SimMode;
  config: FieldConfig; // | CircuitConfig in Phase 8
  result: SolveResult | null;
  label: string;
  createdAt: number;
}

// ── Editor State ──

export type EditorTool = 'select' | 'place_positive' | 'place_negative';

// ── Solver Status ──

export type SolverStatus = 'idle' | 'solving' | 'converged' | 'failed' | 'cancelled';

export interface SolverProgress {
  iterations: number;
  residual: number;
}
