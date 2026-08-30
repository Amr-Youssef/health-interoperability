import { Gender, ProvenanceInfo } from './types.js';
import { PatientIdentifier } from './patient-identifier.js';
export interface CanonicalPatient {
    internalId: string;
    givenName: string;
    familyName: string;
    givenNameAr?: string;
    familyNameAr?: string;
    gender: Gender;
    birthDate: string;
    nationality?: string;
    nationalityCode?: string;
    maritalStatus?: string;
    phone?: string;
    email?: string;
    address?: {
        line?: string;
        lineAr?: string;
        city?: string;
        cityAr?: string;
        district?: string;
        districtAr?: string;
        postalCode?: string;
        country?: string;
    };
    religion?: string;
    occupation?: string;
    identifiers: PatientIdentifier[];
    provenance: ProvenanceInfo;
    createdAt: string;
    updatedAt: string;
}
