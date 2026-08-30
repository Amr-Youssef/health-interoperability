import { RawRecord } from '../../core/domain/raw-record.js';
import { SourceAdapter, AdapterStatus, SourceSchemaDescriptor } from './adapter.interface.js';
export declare class HospitalBAdapter implements SourceAdapter {
    readonly sourceSystemId = "hospital-b";
    readonly sourceSystemName = "\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0646\u0648\u0631 \u0627\u0644\u062D\u062F\u064A\u062B (Hospital B - Relational HIS)";
    readonly adapterVersion = "1.4.0";
    private calculateChecksum;
    extractAll(batchId?: string): Promise<RawRecord[]>;
    extractEntity(entityType: string, batchId?: string): Promise<RawRecord[]>;
    healthCheck(): Promise<AdapterStatus>;
    describeSchema(): SourceSchemaDescriptor;
}
