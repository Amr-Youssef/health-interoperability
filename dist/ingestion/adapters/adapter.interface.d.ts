import { RawRecord } from '../../core/domain/raw-record.js';
export interface SourceSchemaDescriptor {
    systemId: string;
    systemName: string;
    sourceType: 'relational' | 'fhir' | 'hl7v2';
    entityTypes: string[];
    fieldCatalog: Record<string, {
        field: string;
        type: string;
        arabicLabel?: string;
        sampleValue?: any;
    }[]>;
}
export interface AdapterStatus {
    systemId: string;
    status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
    lastHeartbeat: string;
    latencyMs: number;
    extractedRecordCount: number;
    version: string;
}
export interface SourceAdapter {
    readonly sourceSystemId: string;
    readonly sourceSystemName: string;
    readonly adapterVersion: string;
    extractAll(batchId?: string): Promise<RawRecord[]>;
    extractEntity(entityType: string, batchId?: string): Promise<RawRecord[]>;
    healthCheck(): Promise<AdapterStatus>;
    describeSchema(): SourceSchemaDescriptor;
}
