import { RawStore } from '../ingestion/raw-store/raw-store.interface.js';
import { SourceAdapter } from '../ingestion/adapters/adapter.interface.js';
import { DynamicHospitalRegistry, DynamicHospitalDefinition } from '../ingestion/dynamic/dynamic-adapter.js';
import { MappingEngine } from '../mapping/engine/mapping-engine.js';
import { TerminologyService } from '../terminology/terminology-service.js';
import { DataQualityEngine } from '../validation/validation-engine.js';
import { MasterPatientIndexService } from '../mpi/mpi-service.js';
import { CanonicalStore } from '../persistence/canonical-store.js';
import { ProvenanceService } from '../provenance/provenance-service.js';
import { FhirR4Serializer } from '../fhir/fhir-serializer.js';
import { CdsHooksEngine } from '../cds/cds-engine.js';
import { ConsentManager } from '../security/consent-manager.js';
import { PopulationHealthService } from '../analytics/population-health.js';
import { WeqaaSurveillanceEngine } from '../analytics/weqaa-surveillance.js';
import { CryptographicAuditChain } from '../security/audit-chain.js';
import { FhirBulkExportService } from '../export/bulk-export.js';
import { Hl7v2FeedAdapter } from '../ingestion/hl7v2/hl7-adapter.js';
import { SmartOnFhirAuthService } from '../security/smart-auth.js';
import { CanonicalCoverageEligibility } from '../core/domain/financial.js';
export interface IngestionResult {
    batchId: string;
    sourceCounts: Record<string, number>;
    totalIngested: number;
    processedCount: number;
    acceptedCount: number;
    warningCount: number;
    rejectedCount: number;
    patientsResolvedCount: number;
    coveragesCount: number;
    claimsCount: number;
    medicationsCount: number;
    immunizationsCount: number;
    allergiesCount: number;
    diagnosticReportsCount: number;
}
/**
 * Result of persisting a mapped record. The internalId returned is the
 * surviving id after the idempotent composite-key upsert (sourceSystemId +
 * sourceRecordId + entityType).
 */
export interface PersistOutcome {
    entityType: string;
    internalId: string;
    patientId?: string;
    encounterId?: string;
}
/**
 * Thrown when a clinical/financial record cannot be linked to an existing
 * patient or encounter. Previously the engine silently attached such records
 * to the first patient in the store; now the reference must resolve or the
 * record is rejected for referential integrity.
 */
export declare class UnresolvedReferenceError extends Error {
    readonly sourceSystemId: string;
    readonly sourceRecordId: string;
    readonly referenceKind: 'patient' | 'encounter';
    readonly referenceValue: string;
    constructor(sourceSystemId: string, sourceRecordId: string, referenceKind: 'patient' | 'encounter', referenceValue: string);
}
export declare class NormalizationEngine {
    readonly rawStore: RawStore;
    readonly mappingEngine: MappingEngine;
    readonly terminologyService: TerminologyService;
    readonly qualityEngine: DataQualityEngine;
    readonly mpi: MasterPatientIndexService;
    readonly canonicalStore: CanonicalStore;
    readonly provenanceService: ProvenanceService;
    readonly fhirSerializer: FhirR4Serializer;
    readonly dynamicRegistry: DynamicHospitalRegistry;
    readonly cdsEngine: CdsHooksEngine;
    readonly consentManager: ConsentManager;
    readonly populationHealth: PopulationHealthService;
    readonly weqaaSurveillance: WeqaaSurveillanceEngine;
    readonly auditChain: CryptographicAuditChain;
    readonly bulkExportService: FhirBulkExportService;
    readonly hl7Adapter: Hl7v2FeedAdapter;
    readonly smartAuth: SmartOnFhirAuthService;
    readonly adapters: Map<string, SourceAdapter>;
    private mrnToInternalPatientId;
    private visitToInternalEncounterId;
    constructor(rawStore: RawStore, canonicalStore: CanonicalStore, mpi: MasterPatientIndexService, terminologyService: TerminologyService, provenanceService: ProvenanceService, consentManager?: ConsentManager, auditChain?: CryptographicAuditChain, dynamicRegistry?: DynamicHospitalRegistry);
    onboardHospital(definition: DynamicHospitalDefinition): Promise<void>;
    boot(): Promise<void>;
    /**
     * Ingest and normalize a raw HL7 v2 pipe-delimited message
     */
    ingestHl7v2Message(rawHl7: string): Promise<any>;
    /**
     * Onboard a new Healthcare Facility / Hospital dynamically
     */
    onboardDynamicHospital(definition: DynamicHospitalDefinition): Promise<void>;
    /**
     * Ingest and normalize a custom payload for a dynamic hospital
     */
    ingestDynamicPayload(hospitalId: string, entityType: string, sourceRecordId: string, payload: any): Promise<any>;
    /**
     * Ingest and normalize an uploaded raw clinical/financial file (.hl7, .json, .csv)
     */
    ingestUploadedFile(fileName: string, fileContent: string, sourceSystemId?: string): Promise<{
        format: 'hl7v2' | 'fhir-bundle' | 'csv' | 'json';
        fileName: string;
        totalIngested: number;
        success: boolean;
        details: any;
    }>;
    /**
     * Complete End-to-End Orchestration: Ingest all sources and normalize into Canonical Store
     */
    runFullIngestionPipeline(): Promise<IngestionResult>;
    /**
     * Resolves a patient from source-level identifiers (MRN, FHIR source id,
     * source record id). Returns null when the patient is genuinely unknown —
     * the caller must REJECT the record, never fall back to an arbitrary patient.
     */
    private resolvePatientId;
    /**
     * Resolves a canonical encounter by its source visit identifier. Returns null
     * when the visit is genuinely unknown for this source system.
     */
    private resolveEncounter;
    /**
     * Resolves the patient and encounter a clinical record must be attached to.
     * Integrity policy (no fallback-to-first-patient):
     *  - If the payload references a visit, that visit MUST exist; the patient is
     *    then derived from the resolved encounter.
     *  - Otherwise the payload MUST reference a resolvable patient (MRN/source id).
     * Any missing link throws UnresolvedReferenceError -> the record is rejected.
     */
    private resolveClinicalSubject;
    private persistToCanonical;
    checkPatientEligibility(patientId: string): Promise<CanonicalCoverageEligibility | null>;
    reprocessRecord(rawRecordId: string, customConfig?: any): Promise<any>;
    getIntegrationMonitoringStats(): Promise<any>;
}
