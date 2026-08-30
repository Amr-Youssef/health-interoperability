import { ClinicalCode } from './clinical-code.js';
import { ProvenanceInfo } from './types.js';
export type AllergyClinicalStatus = 'active' | 'inactive' | 'resolved';
export type AllergyVerificationStatus = 'confirmed' | 'unconfirmed' | 'refuted';
export type AllergyType = 'allergy' | 'intolerance';
export type AllergyCategory = 'food' | 'medication' | 'environment' | 'biologic';
export type AllergyCriticality = 'low' | 'high' | 'unable-to-assess';
export type AllergySeverity = 'mild' | 'moderate' | 'severe';
export interface AllergyReaction {
    manifestationCode?: ClinicalCode;
    manifestationText?: string;
    manifestationTextAr?: string;
    severity: AllergySeverity;
    onset?: string;
}
export interface CanonicalAllergyIntolerance {
    internalId: string;
    patientId: string;
    clinicalStatus: AllergyClinicalStatus;
    verificationStatus: AllergyVerificationStatus;
    type: AllergyType;
    category: AllergyCategory;
    criticality: AllergyCriticality;
    substanceCode: ClinicalCode;
    substanceText: string;
    substanceTextAr?: string;
    reactions: AllergyReaction[];
    recordedDate: string;
    recorderPractitionerId?: string;
    provenance: ProvenanceInfo;
}
