import type { PrismaClient } from '@prisma/client';
import { ProvenanceRecord, AuditEntry } from '../core/domain/provenance.js';
export declare class PrismaProvenanceService {
    private prisma;
    constructor(prisma?: PrismaClient);
    recordProvenance(record: ProvenanceRecord): Promise<void>;
    getProvenanceByEntityId(entityId: string): Promise<ProvenanceRecord | null>;
    getAllProvenance(): Promise<ProvenanceRecord[]>;
    recordAudit(entry: AuditEntry): Promise<void>;
    getAuditLog(limit?: number): Promise<AuditEntry[]>;
}
