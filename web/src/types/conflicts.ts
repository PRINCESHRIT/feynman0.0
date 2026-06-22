export type ConflictSeverity = 'error' | 'warning' | 'info';
export type ConflictType = 'structural' | 'numerical';

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  relatedIds: string[]; // IDs of related charges/components
}
