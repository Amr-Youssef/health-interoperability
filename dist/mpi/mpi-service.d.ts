import { InternalPatientIdentity, DuplicateCandidate } from '../core/domain/mpi-identity.js';
export interface ResolveIdentityInput {
    sourceSystemId: string;
    nationalId?: string;
    iqamaNo?: string;
    passportNo?: string;
    mrn?: string;
    givenName?: string;
    familyName?: string;
    givenNameAr?: string;
    familyNameAr?: string;
    birthDate?: string;
    gender?: string;
    phone?: string;
}
export interface ResolveIdentityResult {
    internalPatientId: string;
    isNewPatient: boolean;
    confidence: number;
    matchStrategy: string;
    linkedIdentifiersCount: number;
}
export declare class MasterPatientIndexService {
    private persistPath;
    private identities;
    private duplicateCandidates;
    constructor(persistPath?: string | null);
    private saveToDisk;
    private loadFromDisk;
    /**
     * Cleans and normalizes Arabic strings for matching
     */
    private normalizeArabic;
    /**
     * Main Identity Resolution Algorithm
     */
    resolvePatientIdentity(input: ResolveIdentityInput): Promise<ResolveIdentityResult>;
    private linkNewIdentifiers;
    getIdentity(internalPatientId: string): Promise<InternalPatientIdentity | null>;
    findByIdentifier(type: string, value: string): Promise<InternalPatientIdentity | null>;
    getAllIdentities(): Promise<InternalPatientIdentity[]>;
    /**
     * Deterministic / Probabilistic Patient Identity Merge
     * Links all identifiers from obsolete identity into survivor identity and marks obsolete as MERGED.
     */
    mergePatientIdentities(survivorId: string, obsoleteId: string, reason: string, adminUser?: string): Promise<{
        success: boolean;
        survivor: InternalPatientIdentity;
        obsolete: InternalPatientIdentity;
    }>;
    /**
     * Unmerge previously merged identities
     */
    unmergePatientIdentities(survivorId: string, obsoleteId: string, reason: string, adminUser?: string): Promise<{
        success: boolean;
        survivor: InternalPatientIdentity;
        restored: InternalPatientIdentity;
    }>;
    /**
     * Scans active identities to detect potential duplicate patient candidates for stewardship review
     */
    findDuplicateCandidates(): Promise<DuplicateCandidate[]>;
    clearAll(): Promise<void>;
}
