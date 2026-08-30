import { RawRecord } from '../../core/domain/raw-record.js';
import { SourceAdapter, AdapterStatus, SourceSchemaDescriptor } from './adapter.interface.js';
export declare class HospitalAAdapter implements SourceAdapter {
    readonly sourceSystemId = "hospital-a";
    readonly sourceSystemName = "\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0623\u0645\u0644 \u0627\u0644\u062A\u062E\u0635\u0635\u064A (Hospital A - Legacy HIS)";
    readonly adapterVersion = "1.2.0";
    private calculateChecksum;
    extractAll(batchId?: string): Promise<RawRecord[]>;
    extractEntity(entityType: string, batchId?: string): Promise<RawRecord[]>;
    healthCheck(): Promise<AdapterStatus>;
    describeSchema(): SourceSchemaDescriptor;
}
