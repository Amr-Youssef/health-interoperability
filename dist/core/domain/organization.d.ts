import { ProvenanceInfo } from './types.js';
export interface CanonicalOrganization {
    internalId: string;
    code: string;
    name: string;
    nameAr: string;
    type: 'hospital' | 'clinic' | 'cluster' | 'insurance_company' | 'laboratory' | 'pharmacy';
    parentOrganizationId?: string;
    identifiers: {
        system: string;
        value: string;
        type: string;
    }[];
    cbahiAccredited?: boolean;
    active: boolean;
    provenance: ProvenanceInfo;
}
