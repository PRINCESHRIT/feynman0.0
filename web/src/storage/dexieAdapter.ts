import { db } from './db';
import type { StorageAdapter, StoredConfig, StoredResult } from './storageInterface';

const RESULT_BUDGET_BYTES = 100 * 1024 * 1024; // 100MB

export class DexieAdapter implements StorageAdapter {
  async saveConfig(config: StoredConfig): Promise<void> {
    await db.configs.put(config);
  }

  async loadConfigs(): Promise<StoredConfig[]> {
    return db.configs.orderBy('createdAt').toArray();
  }

  async deleteConfig(id: string): Promise<void> {
    await db.configs.delete(id);
  }

  async saveResult(result: StoredResult): Promise<void> {
    await db.results.put(result);
    // Auto-evict if over budget
    await this.evictResults(RESULT_BUDGET_BYTES);
  }

  async loadResult(id: string): Promise<StoredResult | undefined> {
    const result = await db.results.get(id);
    if (result) {
      // Update lastAccessed
      await db.results.update(id, { lastAccessed: Date.now() });
    }
    return result;
  }

  async deleteResult(id: string): Promise<void> {
    await db.results.delete(id);
  }

  async evictResults(budgetBytes: number): Promise<number> {
    const total = await this.getTotalResultSize();
    if (total <= budgetBytes) return 0;

    let freed = 0;
    let toFree = total - budgetBytes;

    // Get results ordered by lastAccessed (oldest first)
    const results = await db.results.orderBy('lastAccessed').toArray();

    for (const result of results) {
      if (toFree <= 0) break;
      await db.results.delete(result.id);
      toFree -= result.sizeBytes;
      freed += result.sizeBytes;
    }

    return freed;
  }

  async getTotalResultSize(): Promise<number> {
    let total = 0;
    await db.results.each((result) => {
      total += result.sizeBytes;
    });
    return total;
  }
}
