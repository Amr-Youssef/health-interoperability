import { RawRecord } from '../../core/domain/raw-record.js';
import { ProcessingStatus } from '../../core/domain/types.js';
export interface RawStoreStats {
    totalRecords: number;
    bySystem: Record<string, number>;
    byStatus: Record<string, number>;
    byEntityType: Record<string, number>;
}
export interface RawStore {
    save(record: RawRecord): Promise<void>;
    saveBatch(records: RawRecord[]): Promise<void>;
    getById(id: string): Promise<RawRecord | null>;
    findBySource(sourceSystemId: string, entityType?: string): Promise<RawRecord[]>;
    findPending(sourceSystemId?: string): Promise<RawRecord[]>;
    updateStatus(id: string, status: ProcessingStatus, errorMessage?: string): Promise<void>;
    markReprocessed(id: string): Promise<void>;
    getStats(): Promise<RawStoreStats>;
    getAll(): Promise<RawRecord[]>;
    clearAll?(): Promise<void>;
}
