import { Gender, ProvenanceInfo } from './types.js';
export interface CanonicalPractitioner {
    internalId: string;
    givenName: string;
    familyName: string;
    givenNameAr?: string;
    familyNameAr?: string;
    gender?: Gender;
    specialty?: string;
    specialtyAr?: string;
    identifiers: {
        system: string;
        value: string;
        type: 'SCFHS_LICENSE' | 'NID' | 'STAFF_ID' | 'OTHER';
    }[];
    organizationId?: string;
    active: boolean;
    provenance: ProvenanceInfo;
}
