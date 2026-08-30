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
    code: ClinicalCode;
    recordedDate: string;
    onsetDate?: string;
    abatementDate?: string;
    note?: string;
    provenance: ProvenanceInfo;
    createdAt: string;
}
