import Dexie, { type EntityTable } from 'dexie';
import type { StoredConfig, StoredResult } from './storageInterface';

export class FeynmanDB extends Dexie {
  configs!: EntityTable<StoredConfig, 'id'>;
  results!: EntityTable<StoredResult, 'id'>;

  constructor() {
    super('feynman-lessons');

    this.version(1).stores({
      configs: 'id, parentId, createdAt',
      results: 'id, lastAccessed, sizeBytes',
    });
  }
}

export const db = new FeynmanDB();
