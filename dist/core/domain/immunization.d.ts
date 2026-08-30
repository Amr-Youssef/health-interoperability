import { ProvenanceInfo } from './types.js';
import { ClinicalCode } from './clinical-code.js';
export interface CanonicalImmunization {
    internalId: string;
    patientId: string;
    encounterId?: string;
    status: 'completed' | 'not-done';
    vaccineCode: ClinicalCode;
    occurrenceDateTime: string;
    lotNumber: string;
    expirationDate: string;
    site?: string;
    route?: string;
    doseQuantity?: {
        value: number;
        unit: string;
    };
    performerPractitionerName?: string;
    manufacturer?: string;
    provenance: ProvenanceInfo;
    createdAt: string;
}
