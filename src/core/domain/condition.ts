import { ConditionCategory, ConditionRank, ProvenanceInfo } from './types.js';
import { ClinicalCode } from './clinical-code.js';

export interface CanonicalCondition {
  internalId: string;
  patientId: string;
  encounterId?: string;
  
  clinicalStatus: 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved';
  verificationStatus?: 'unconfirmed' | 'provisional' | 'differential' | 'confirmed' | 'refuted';
  
  category: ConditionCategory;
  rank: ConditionRank;
  
  // Multi-system code representation (SNOMED, ICD-10-AM, SBS, local)
  code: ClinicalCode;
  
  recordedDate: string; // ISO 8601
  onsetDate?: string;
  abatementDate?: string;
  note?: string;
  
  provenance: ProvenanceInfo;
  createdAt: string;
}
