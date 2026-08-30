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
    private persistPath;
    private chain;
    private genesisHash;
    constructor(persistPath?: string | null);
    private saveToDisk;
    private loadFromDisk;
    private createGenesisBlock;
    recordEvent(action: 'INGEST' | 'TRANSFORM' | 'QUERY' | 'CONSENT_CHANGE' | 'BREAK_GLASS' | 'BULK_EXPORT', actor: string, entityType: string, entityId: string, details: string): AuditBlock;
    getChain(): AuditBlock[];
    getRecentEvents(limit?: number): AuditBlock[];
    verifyChainIntegrity(): {
        isValid: boolean;
        brokenAtIndex?: number;
        totalBlocks: number;
    };
    clearAll(): void;
}
