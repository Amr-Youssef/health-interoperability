export interface BilingualText {
  ar: string;
  en?: string;
}

export type Gender = 'male' | 'female' | 'other' | 'unknown';

export type IdentifierType = 'NID' | 'IQAMA' | 'PASSPORT' | 'MRN' | 'SCFHS_LICENSE' | 'OTHER';

export type ClinicalCodingPurpose = 'CLINICAL' | 'CLASSIFICATION' | 'BILLING' | 'STANDARD_LAB';

export type MappingEquivalence = 'EQUIVALENT' | 'WIDER' | 'NARROWER' | 'INEXACT' | 'UNMATCHED';

export type EncounterClass = 'inpatient' | 'outpatient' | 'emergency' | 'virtual';

export type ConditionCategory = 'encounter-diagnosis' | 'problem-list-item';

export type ConditionRank = 'primary' | 'secondary';

export type ObservationCategory = 'laboratory' | 'vital-signs' | 'exam';

export type ProcessingStatus = 
  | 'PENDING' 
  | 'RAW_INGESTED' 
  | 'MAPPED' 
  | 'VALIDATED' 
  | 'PERSISTED' 
  | 'FAILED' 
  | 'REPROCESSED';

export type ValidationDecision = 
  | 'ACCEPTED' 
  | 'ACCEPTED_WITH_WARNINGS' 
  | 'REJECTED' 
  | 'MANUAL_REVIEW';

export interface ValidationIssue {
  field: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  rule: string;
  message: string;
  sourceValue?: any;
}

export interface ValidationResult {
  recordId: string;
  score: number; // 0 - 100
  decision: ValidationDecision;
  issues: ValidationIssue[];
  validatedAt: string;
  validationRuleVersion: string;
}

export interface ProvenanceInfo {
  sourceSystemId: string;
  sourceRecordId: string;
  rawRecordId: string;
  adapterVersion: string;
  mappingVersion: string;
  terminologyMapVersion: string;
  ingestedAt: string;
  transformedAt: string;
  persistedAt: string;
  validationScore: number;
  validationDecision: ValidationDecision;
}
