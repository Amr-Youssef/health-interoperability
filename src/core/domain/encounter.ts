import { EncounterClass, ProvenanceInfo } from './types.js';
import { ClinicalCode } from './clinical-code.js';

export interface CanonicalEncounter {
  internalId: string;
  patientId: string; // FK to CanonicalPatient
  sourceVisitId: string;
  
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled';
  class: EncounterClass;
  type?: ClinicalCode; // SNOMED CT encounter type
  
  period: {
    start: string; // ISO 8601
    end?: string;
  };
  
  reasonCode?: ClinicalCode;
  reasonText?: string;
  reasonTextAr?: string;
  
  serviceProviderId?: string; // FK to CanonicalOrganization
  attendingPractitionerId?: string; // FK to CanonicalPractitioner
  department?: string;
  departmentAr?: string;
  
  provenance: ProvenanceInfo;
  createdAt: string;
}
