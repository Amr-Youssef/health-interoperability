import { ValidationDecision } from './types.js';
export interface ProvenanceRecord {
    id: string;
    targetEntityType: 'CanonicalPatient' | 'CanonicalEncounter' | 'CanonicalCondition' | 'CanonicalObservation' | 'CanonicalCoverage' | 'CanonicalClaim' | 'CanonicalMedicationRequest' | 'CanonicalImmunization' | 'CanonicalAllergyIntolerance' | 'CanonicalDiagnosticReport';
    targetEntityId: string;
    sourceSystemId: string;
    sourceRecordId: string;
    rawRecordId: string;
    adapterVersion: string;
    mappingConfigId: string;
    mappingVersion: string;
    terminologyMapId?: string;
    terminologyMapVersion?: string;
    sourceTimestamp?: string;
    ingestedAt: string;
    transformedAt: string;
    persistedAt: string;
    validationScore: number;
    validationDecision: ValidationDecision;
    activityDescription: string;
}
export interface AuditEntry {
    id: string;
    timestamp: string;
    action: 'INGESTED' | 'MAPPED' | 'VALIDATED' | 'PERSISTED' | 'ACCESSED' | 'EXPORTED' | 'REPROCESSED';
    entityType: string;
    entityId: string;
    actor: string;
    detail: string;
    sourceIp?: string;
    metadata?: Record<string, any>;
}
