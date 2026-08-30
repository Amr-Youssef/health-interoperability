import { ObservationCategory, ProvenanceInfo } from './types.js';
import { ClinicalCode } from './clinical-code.js';
export interface CanonicalObservation {
    internalId: string;
    patientId: string;
    encounterId?: string;
    status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled';
    category: ObservationCategory;
    code: ClinicalCode;
    effectiveDateTime: string;
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
