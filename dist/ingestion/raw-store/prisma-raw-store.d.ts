import { PrismaClient } from '@prisma/client';
import { RawRecord } from '../../core/domain/raw-record.js';
import { ProcessingStatus } from '../../core/domain/types.js';
import { RawStore, RawStoreStats } from './raw-store.interface.js';
export declare class PrismaRawStore implements RawStore {
    private prisma;
    constructor(prisma?: PrismaClient);
    private toDomain;
    save(record: RawRecord): Promise<void>;
    saveBatch(records: RawRecord[]): Promise<void>;
    getById(id: string): Promise<RawRecord | null>;
    findBySource(sourceSystemId: string, entityType?: string): Promise<RawRecord[]>;
    findPending(sourceSystemId?: string): Promise<RawRecord[]>;
    updateStatus(id: string, status: ProcessingStatus, errorMessage?: string): Promise<void>;
    markReprocessed(id: string): Promise<void>;
    getStats(): Promise<RawStoreStats>;
    getAll(): Promise<RawRecord[]>;
    clearAll(): Promise<void>;
}
