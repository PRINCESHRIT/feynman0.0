import type { Run, SolveResult } from '../types/simulation';

export interface StoredConfig {
  id: string;
  parentId: string | null;
  config: string; // JSON-serialized FieldConfig
  mode: string;
  label: string;
  createdAt: number;
}

export interface StoredResult {
  id: string;
  potential: ArrayBuffer;
  width: number;
  height: number;
  iterations: number;
  residual: number;
  converged: boolean;
  timeMs: number;
  lastAccessed: number;
  sizeBytes: number;
}

export interface StorageAdapter {
  saveConfig(config: StoredConfig): Promise<void>;
  loadConfigs(): Promise<StoredConfig[]>;
  deleteConfig(id: string): Promise<void>;

  saveResult(result: StoredResult): Promise<void>;
  loadResult(id: string): Promise<StoredResult | undefined>;
  deleteResult(id: string): Promise<void>;

  evictResults(budgetBytes: number): Promise<number>;
  getTotalResultSize(): Promise<number>;
}
