import { PrismaRawStore } from '../ingestion/raw-store/prisma-raw-store.js';
import { PrismaCanonicalStore } from '../persistence/prisma-canonical-store.js';
import { PrismaMpiService } from '../mpi/prisma-mpi-service.js';
import { PrismaTerminologyService } from '../terminology/prisma-terminology-service.js';
import { PrismaProvenanceService } from '../provenance/prisma-provenance-service.js';
import { NormalizationEngine } from '../orchestration/normalization-engine.js';
export declare function createPlatformApp(): {
    app: import("express-serve-static-core").Express;
    engine: NormalizationEngine;
    rawStore: PrismaRawStore;
    canonicalStore: PrismaCanonicalStore;
    mpi: PrismaMpiService;
    terminologyService: PrismaTerminologyService;
    provenanceService: PrismaProvenanceService;
};
