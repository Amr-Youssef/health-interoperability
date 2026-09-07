import { CanonicalPatient } from '../core/domain/patient.js';
import { CanonicalEncounter } from '../core/domain/encounter.js';
import { CanonicalCondition } from '../core/domain/condition.js';
import { CanonicalObservation } from '../core/domain/observation.js';
import { CanonicalOrganization } from '../core/domain/organization.js';
import { CanonicalPractitioner } from '../core/domain/practitioner.js';
import { CanonicalCoverage, CanonicalClaim, CanonicalClaimResponse } from '../core/domain/financial.js';
import { CanonicalMedicationRequest } from '../core/domain/medication.js';
import { CanonicalImmunization } from '../core/domain/immunization.js';
import { CanonicalAllergyIntolerance } from '../core/domain/allergy-intolerance.js';
import { CanonicalDiagnosticReport } from '../core/domain/diagnostic-report.js';
/**
 * @deprecated LEGACY — File-based JSON store. Do not use in production. Use PrismaCanonicalStore (PostgreSQL) via ICanonicalStore.
 * Retained only for unit tests/benchmarks that run without DB. See src/persistence/canonical-store.interface.ts
 */
import type { LongitudinalRecord } from '../core/domain/longitudinal-record.js';
import type { ICanonicalStore } from './canonical-store.interface.js';
export type { LongitudinalRecord };
export declare class CanonicalStore implements ICanonicalStore {
    private persistPath;
    private patients;
    private encounters;
    private conditions;
    private observations;
    private organizations;
    private practitioners;
    private coverages;
    private claims;
    private claimResponses;
    private medicationRequests;
    private immunizations;
    private allergies;
    private diagnosticReports;
    constructor(persistPath?: string | null);
    /**
     * Builds the explicit idempotency key for a canonical entity.
     * Composite key = sourceSystemId + sourceRecordId + entityType.
     * Returns null when the reference is incomplete (such records are never
     * deduplicated or upserted by source — they are always treated as new).
     */
    private buildSourceKey;
    private findExistingIdBySource;
    /**
     * Idempotent upsert keyed on the composite (sourceSystemId + sourceRecordId +
     * entityType). On collision the existing entity is overwritten with the newly
     * received payload while preserving its original internalId and createdAt.
     */
    private upsertBySource;
    /**
     * Collapses duplicate legacy entities that share the same composite source key.
     * Keeps the first-loaded survivor and records a remap (dropped id -> survivor id)
     * so downstream references can be rewritten during disk load.
     */
    private dedupeByCompositeKey;
    /**
     * Persist canonical store data to disk
     */
    private saveToDisk;
    /**
     * Load canonical store data from disk
     */
    private loadFromDisk;
    savePatient(patient: CanonicalPatient): Promise<string>;
    getPatient(internalId: string): Promise<CanonicalPatient | null>;
    findPatientByIdentifier(value: string, sourceSystemId?: string): Promise<CanonicalPatient | null>;
    /**
     * Looks up a patient by its originating source record id (e.g. HL7 motor,
     * dynamic payload, relational row). Used to attach clinical records to the
     * exact patient instance created from the same source record.
     */
    findPatientBySourceRecordId(sourceSystemId: string, sourceRecordId: string): Promise<CanonicalPatient | null>;
    getAllPatients(): Promise<CanonicalPatient[]>;
    saveEncounter(encounter: CanonicalEncounter): Promise<string>;
    getEncounter(internalId: string): Promise<CanonicalEncounter | null>;
    findEncounterBySourceVisitId(sourceSystemId: string, sourceVisitId: string): Promise<CanonicalEncounter | null>;
    getEncountersByPatient(patientId: string): Promise<CanonicalEncounter[]>;
    getAllEncounters(): Promise<CanonicalEncounter[]>;
    saveCondition(condition: CanonicalCondition): Promise<string>;
    getConditionsByPatient(patientId: string): Promise<CanonicalCondition[]>;
    getAllConditions(): Promise<CanonicalCondition[]>;
    saveObservation(observation: CanonicalObservation): Promise<string>;
    getObservationsByPatient(patientId: string): Promise<CanonicalObservation[]>;
    getAllObservations(): Promise<CanonicalObservation[]>;
    saveCoverage(coverage: CanonicalCoverage): Promise<string>;
    getCoveragesByPatient(patientId: string): Promise<CanonicalCoverage[]>;
    getAllCoverages(): Promise<CanonicalCoverage[]>;
    saveClaim(claim: CanonicalClaim): Promise<string>;
    getClaimsByPatient(patientId: string): Promise<CanonicalClaim[]>;
    getAllClaims(): Promise<CanonicalClaim[]>;
    saveClaimResponse(response: CanonicalClaimResponse): Promise<void>;
    getClaimResponse(claimId: string): Promise<CanonicalClaimResponse | null>;
    saveMedicationRequest(rx: CanonicalMedicationRequest): Promise<string>;
    getMedicationRequestsByPatient(patientId: string): Promise<CanonicalMedicationRequest[]>;
    getAllMedicationRequests(): Promise<CanonicalMedicationRequest[]>;
    saveImmunization(imm: CanonicalImmunization): Promise<string>;
    getImmunizationsByPatient(patientId: string): Promise<CanonicalImmunization[]>;
    getAllImmunizations(): Promise<CanonicalImmunization[]>;
    saveAllergyIntolerance(allergy: CanonicalAllergyIntolerance): Promise<string>;
    getAllergiesByPatient(patientId: string): Promise<CanonicalAllergyIntolerance[]>;
    getAllAllergies(): Promise<CanonicalAllergyIntolerance[]>;
    saveDiagnosticReport(report: CanonicalDiagnosticReport): Promise<string>;
    getDiagnosticReportsByPatient(patientId: string): Promise<CanonicalDiagnosticReport[]>;
    getAllDiagnosticReports(): Promise<CanonicalDiagnosticReport[]>;
    getLongitudinalRecord(patientId: string): Promise<LongitudinalRecord | null>;
    saveOrganization(org: CanonicalOrganization): Promise<void>;
    savePractitioner(prac: CanonicalPractitioner): Promise<void>;
    /**
     * Reassigns all clinical and financial records from an obsolete patient ID to a survivor patient ID during an MPI Merge
     */
    reassignPatientRecords(sourcePatientId: string, targetPatientId: string): Promise<{
        encountersUpdated: number;
        conditionsUpdated: number;
        observationsUpdated: number;
        medicationsUpdated: number;
        immunizationsUpdated: number;
        allergiesUpdated: number;
        diagnosticReportsUpdated: number;
        claimsUpdated: number;
        coveragesUpdated: number;
    }>;
    clearAll(): Promise<void>;
}
