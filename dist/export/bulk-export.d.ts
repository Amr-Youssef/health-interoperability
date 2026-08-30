import { CanonicalStore } from '../persistence/canonical-store.js';
export interface BulkExportResult {
    transactionTime: string;
    request: string;
    requiresAccessToken: boolean;
    output: {
        type: string;
        count: number;
        ndjson: string;
    }[];
    isAnonymized: boolean;
    totalResourcesExported: number;
}
export declare class FhirBulkExportService {
    private canonicalStore;
    private fhirSerializer;
    constructor(canonicalStore: CanonicalStore);
    exportBulkData(options?: {
        anonymize?: boolean;
        resourceTypes?: string[];
    }): Promise<BulkExportResult>;
}
