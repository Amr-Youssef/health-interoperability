import { SourceAdapter, SourceSchemaDescriptor, AdapterStatus } from '../adapters/adapter.interface.js';
import { RawRecord } from '../../core/domain/raw-record.js';
import { ParsedHl7Message } from './hl7-parser.js';
export declare class Hl7v2FeedAdapter implements SourceAdapter {
    readonly sourceSystemId = "hl7v2-mllp-feed";
    readonly sourceSystemName = "HL7 v2.5 MLLP Network Ingestion Feed";
    readonly adapterVersion = "1.0.0";
    private parser;
    private queuedRecords;
    extractAll(batchId?: string): Promise<RawRecord[]>;
    extractEntity(entityType: string, batchId?: string): Promise<RawRecord[]>;
    describeSchema(): SourceSchemaDescriptor;
    healthCheck(): Promise<AdapterStatus>;
    /**
     * Process incoming raw HL7 v2.x string, compute SHA-256, and produce RawRecord
     */
    processHl7Message(rawHl7: string, batchId?: string): {
        rawRecord: RawRecord;
        parsed: ParsedHl7Message;
    };
}
