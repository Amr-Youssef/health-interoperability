import { SqliteRawStore } from '../ingestion/raw-store/sqlite-raw-store.js';
import { CanonicalStore } from '../persistence/canonical-store.js';
import { MasterPatientIndexService } from '../mpi/mpi-service.js';
import { TerminologyService } from '../terminology/terminology-service.js';
import { ProvenanceService } from '../provenance/provenance-service.js';
import { NormalizationEngine } from '../orchestration/normalization-engine.js';
export declare function createPlatformApp(): {
    app: import("express-serve-static-core").Express;
    engine: NormalizationEngine;
    rawStore: SqliteRawStore;
    canonicalStore: CanonicalStore;
    mpi: MasterPatientIndexService;
    terminologyService: TerminologyService;
    provenanceService: ProvenanceService;
};
