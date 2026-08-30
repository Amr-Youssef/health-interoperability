import { ProvenanceInfo } from './types.js';
import { ClinicalCode } from './clinical-code.js';

export interface CanonicalImmunization {
  internalId: string;
  patientId: string;
  encounterId?: string;
  
  status: 'completed' | 'not-done';
  vaccineCode: ClinicalCode; // Saudi MOH Vaccine Code + CVX + Trade Name
  
  occurrenceDateTime: string;
  lotNumber: string;
  expirationDate: string;
  
  site?: string; // e.g. "Left Arm Deltoid", "العضلة الدالية اليسرى"
  route?: string; // e.g. "Intramuscular injection", "حقن عضلي"
  doseQuantity?: {
    value: number;
    unit: string;
  };
  
  performerPractitionerName?: string;
  manufacturer?: string;
  
  provenance: ProvenanceInfo;
  createdAt: string;
}
