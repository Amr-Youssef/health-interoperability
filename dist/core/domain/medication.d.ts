import { ProvenanceInfo } from './types.js';
import { ClinicalCode } from './clinical-code.js';
export interface CanonicalMedication {
    internalId: string;
    code: ClinicalCode;
    status: 'active' | 'inactive';
    form: string;
    strength: string;
    manufacturer?: string;
}
export interface DosageInstruction {
    text: string;
    textAr?: string;
    timing: {
        frequency: number;
        period: number;
        periodUnit: 'd' | 'h' | 'wk';
    };
    route: string;
    doseQuantity: {
        value: number;
        unit: string;
    };
    asNeeded?: boolean;
}
export interface DispenseRequest {
    validityPeriod?: {
        start: string;
        end: string;
    };
    numberOfRepeatsAllowed: number;
    quantity: {
        value: number;
        unit: string;
    };
    expectedSupplyDurationDays: number;
}
export interface CanonicalMedicationRequest {
    internalId: string;
    patientId: string;
    encounterId?: string;
    status: 'active' | 'completed' | 'cancelled' | 'stopped' | 'draft';
    intent: 'order' | 'plan';
    medication: CanonicalMedication;
    requesterPractitionerId?: string;
    requesterPractitionerName?: string;
    authoredOn: string;
    dosageInstruction: DosageInstruction[];
    dispenseRequest?: DispenseRequest;
    reasonCode?: ClinicalCode;
    provenance: ProvenanceInfo;
    createdAt: string;
}
