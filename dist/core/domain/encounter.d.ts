import { EncounterClass, ProvenanceInfo } from './types.js';
import { ClinicalCode } from './clinical-code.js';
export interface CanonicalEncounter {
    internalId: string;
    patientId: string;
    sourceVisitId: string;
    status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled';
    class: EncounterClass;
    type?: ClinicalCode;
    period: {
        start: string;
        end?: string;
    };
    reasonCode?: ClinicalCode;
    reasonText?: string;
    reasonTextAr?: string;
    serviceProviderId?: string;
    attendingPractitionerId?: string;
    department?: string;
    departmentAr?: string;
    provenance: ProvenanceInfo;
    createdAt: string;
}
