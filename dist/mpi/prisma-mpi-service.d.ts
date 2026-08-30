import { PrismaClient } from '@prisma/client';
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
export declare class PrismaMpiService {
    private prisma;
    constructor(prisma?: PrismaClient);
    private normalizeArabic;
    private mapIdentityToDomain;
    resolvePatientIdentity(input: ResolveIdentityInput): Promise<ResolveIdentityResult>;
    private linkNewIdentifiers;
    getIdentity(internalPatientId: string): Promise<InternalPatientIdentity | null>;
    findByIdentifier(type: string, value: string): Promise<InternalPatientIdentity | null>;
    getAllIdentities(): Promise<InternalPatientIdentity[]>;
    mergePatientIdentities(survivorId: string, obsoleteId: string, reason: string, adminUser?: string): Promise<{
        success: boolean;
    }>;
    unmergePatientIdentities(survivorId: string, obsoleteId: string, reason: string, adminUser?: string): Promise<{
        success: boolean;
    }>;
    findDuplicateCandidates(): Promise<DuplicateCandidate[]>;
    clearAll(): Promise<void>;
}
