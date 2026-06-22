export type ComponentType = 'resistor' | 'voltage_source' | 'current_source' | 'wire' | 'ground';

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  nodeA: number;
  nodeB: number;
  value: number; // resistance (Ω), voltage (V), current (A)
  x: number;     // schematic position
  y: number;
  rotation: number; // 0, 90, 180, 270
}

export interface CircuitConfig {
  components: CircuitComponent[];
  nextNodeId: number;
}

export interface CircuitResult {
  nodeVoltages: number[];
  branchCurrents: Array<{ id: string; current: number }>;
  success: boolean;
  error?: string;
}
