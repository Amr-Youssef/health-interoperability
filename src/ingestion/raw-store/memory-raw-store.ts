import fs from 'fs';
import path from 'path';
import { RawRecord } from '../../core/domain/raw-record.js';
import { ProcessingStatus } from '../../core/domain/types.js';
import { RawStore, RawStoreStats } from './raw-store.interface.js';

export class InMemoryRawStore implements RawStore {
  private persistPath: string;
  private records: Map<string, RawRecord> = new Map();

  constructor(persistPath?: string | null) {
    if (persistPath === null) {
      this.persistPath = '';
    } else {
      this.persistPath = persistPath || path.resolve(process.cwd(), '.data', 'raw-store.json');
      this.loadFromDisk();
    }
  }

  private saveToDisk(): void {
    if (!this.persistPath) return;
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.persistPath, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('⚠️ RawStore disk persistence warning:', err.message);
    }
  }

  private loadFromDisk(): void {
    if (!this.persistPath) return;
    try {
      if (!fs.existsSync(this.persistPath)) return;
      const raw = fs.readFileSync(this.persistPath, 'utf-8');
      const records: RawRecord[] = JSON.parse(raw);
      for (const r of records) {
        this.records.set(r.id, r);
      }
      console.log(`📂 Loaded ${this.records.size} raw record(s) from disk store.`);
    } catch (err: any) {
      console.warn('⚠️ RawStore disk load warning:', err.message);
    }
  }

  async save(record: RawRecord): Promise<void> {
    this.records.set(record.id, { ...record });
    this.saveToDisk();
  }

  async saveBatch(records: RawRecord[]): Promise<void> {
    for (const record of records) {
      this.records.set(record.id, { ...record });
    }
    this.saveToDisk();
  }

  async getById(id: string): Promise<RawRecord | null> {
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  async findBySource(sourceSystemId: string, entityType?: string): Promise<RawRecord[]> {
    const result: RawRecord[] = [];
    for (const record of this.records.values()) {
      if (record.sourceSystemId === sourceSystemId) {
        if (!entityType || record.sourceEntityType.toLowerCase() === entityType.toLowerCase()) {
          result.push({ ...record });
        }
      }
    }
    return result;
  }

  async findPending(sourceSystemId?: string): Promise<RawRecord[]> {
    const result: RawRecord[] = [];
    for (const record of this.records.values()) {
      if (record.processingStatus === 'PENDING' || record.processingStatus === 'REPROCESSED') {
        if (!sourceSystemId || record.sourceSystemId === sourceSystemId) {
          result.push({ ...record });
        }
      }
    }
    return result;
  }

  async updateStatus(id: string, status: ProcessingStatus, errorMessage?: string): Promise<void> {
    const record = this.records.get(id);
    if (record) {
      record.processingStatus = status;
      if (errorMessage) record.errorMessage = errorMessage;
      this.records.set(id, record);
      this.saveToDisk();
    }
  }

  async markReprocessed(id: string): Promise<void> {
    const record = this.records.get(id);
    if (record) {
      record.processingStatus = 'PENDING';
      record.reprocessCount = (record.reprocessCount || 0) + 1;
      record.lastReprocessedAt = new Date().toISOString();
      delete record.errorMessage;
      this.records.set(id, record);
      this.saveToDisk();
    }
  }

  async getStats(): Promise<RawStoreStats> {
    const bySystem: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};

    for (const r of this.records.values()) {
      bySystem[r.sourceSystemId] = (bySystem[r.sourceSystemId] || 0) + 1;
      byStatus[r.processingStatus] = (byStatus[r.processingStatus] || 0) + 1;
      const entityKey = `${r.sourceSystemId}:${r.sourceEntityType}`;
      byEntityType[entityKey] = (byEntityType[entityKey] || 0) + 1;
    }

    return {
      totalRecords: this.records.size,
      bySystem,
      byStatus,
      byEntityType
    };
  }

  async getAll(): Promise<RawRecord[]> {
    return Array.from(this.records.values()).map(r => ({ ...r }));
  }

  async clearAll(): Promise<void> {
    this.records.clear();
    this.saveToDisk();
  }
}
