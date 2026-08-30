import { ObservationCategory, ProvenanceInfo } from './types.js';
import { ClinicalCode } from './clinical-code.js';

export interface CanonicalObservation {
  internalId: string;
  patientId: string;
  encounterId?: string;
  
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled';
  category: ObservationCategory;
  
  // Test / Measurement identification (LOINC, SNOMED CT, local code)
  code: ClinicalCode;
  
  effectiveDateTime: string; // ISO 8601
  
  valueType: 'quantity' | 'string' | 'concept' | 'boolean';
  valueQuantity?: {
    value: number;
    unit: string;
    system?: string;
    code?: string;
  };
  valueString?: string;
  valueConcept?: ClinicalCode;
  
  referenceRange?: {
    low?: number;
    high?: number;
    unit?: string;
    text?: string;
  };
  
  interpretation?: 'N' | 'L' | 'H' | 'LL' | 'HH' | 'A' | 'NORMAL' | 'ABNORMAL' | 'HIGH' | 'LOW';
  
  performerId?: string;
  note?: string;
  
  provenance: ProvenanceInfo;
  createdAt: string;
}
