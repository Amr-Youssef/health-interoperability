import { RawRecord } from '../../core/domain/raw-record.js';
import { SourceAdapter, AdapterStatus, SourceSchemaDescriptor } from './adapter.interface.js';
export declare class HospitalCAdapter implements SourceAdapter {
    readonly sourceSystemId = "hospital-c";
    readonly sourceSystemName = "\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u0644\u0643 \u0641\u0647\u062F \u0627\u0644\u062A\u062E\u0635\u0635\u064A (Hospital C - FHIR Native R4)";
    readonly adapterVersion = "2.0.0";
    private calculateChecksum;
    extractAll(batchId?: string): Promise<RawRecord[]>;
    extractEntity(entityType: string, batchId?: string): Promise<RawRecord[]>;
    healthCheck(): Promise<AdapterStatus>;
    describeSchema(): SourceSchemaDescriptor;
}
