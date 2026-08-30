import { ProvenanceInfo } from './types.js';
import { ClinicalCode } from './clinical-code.js';

export interface CanonicalMedication {
  internalId: string;
  code: ClinicalCode; // SFDA SDC, Generic Name, Trade Name, ATC, RxNorm
  status: 'active' | 'inactive';
  form: string; // e.g. "Tablet", "قرص فموي"
  strength: string; // e.g. "500 mg"
  manufacturer?: string; // e.g. "SPIMACO", "سبيماكو السعودية"
}

export interface DosageInstruction {
  text: string;
  textAr?: string;
  timing: {
    frequency: number; // e.g. 2 times
    period: number;    // e.g. 1
    periodUnit: 'd' | 'h' | 'wk'; // per day
  };
  route: string; // 'Oral', 'فموي'
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
  numberOfRepeatsAllowed: number; // e.g. 2 refills
  quantity: {
    value: number;
    unit: string;
  };
  expectedSupplyDurationDays: number; // e.g. 30 days
}

export interface CanonicalMedicationRequest {
  internalId: string;
  patientId: string;
  encounterId?: string;
  
  status: 'active' | 'completed' | 'cancelled' | 'stopped' | 'draft';
  intent: 'order' | 'plan';
  
  // Medication Information
  medication: CanonicalMedication;
  
  // Prescribing details
  requesterPractitionerId?: string;
  requesterPractitionerName?: string;
  authoredOn: string;
  
  dosageInstruction: DosageInstruction[];
  dispenseRequest?: DispenseRequest;
  
  reasonCode?: ClinicalCode; // Link to diagnosis (e.g. Type 2 Diabetes)
  provenance: ProvenanceInfo;
  createdAt: string;
}
