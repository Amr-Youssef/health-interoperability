import type { PrismaClient } from '@prisma/client';
export interface AuditBlock {
    index: number;
    blockId: string;
    timestamp: string;
    action: 'INGEST' | 'TRANSFORM' | 'QUERY' | 'CONSENT_CHANGE' | 'BREAK_GLASS' | 'BULK_EXPORT';
    actor: string;
    entityType: string;
    entityId: string;
    details: string;
    previousHash: string;
    currentHash: string;
}
export declare class CryptographicAuditChain {
    private prisma;
    private genesisHash;
    constructor(prisma?: PrismaClient);
    private getChainLength;
    private static readonly CHAIN_ACTIONS;
    private getLastBlock;
    recordEvent(action: 'INGEST' | 'TRANSFORM' | 'QUERY' | 'CONSENT_CHANGE' | 'BREAK_GLASS' | 'BULK_EXPORT', actor: string, entityType: string, entityId: string, details: string): Promise<AuditBlock>;
    getRecentEvents(limit?: number): Promise<AuditBlock[]>;
    verifyChainIntegrity(): Promise<{
        isValid: boolean;
        brokenAtIndex?: number;
        totalBlocks: number;
    }>;
    clearAll(): Promise<void>;
}
