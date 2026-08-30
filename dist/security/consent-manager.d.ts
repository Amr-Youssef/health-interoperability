import { PrismaClient } from '@prisma/client';
export type ConsentPolicyType = 'OPT_IN_FULL' | 'RESTRICT_SENSITIVE' | 'CLUSTER_ONLY' | 'EXPLICIT_PER_ENCOUNTER';
export interface PatientConsentDirective {
    patientId: string;
    policy: ConsentPolicyType;
    allowedOrganizations: string[];
    blockedCategories: string[];
    allowEmergencyOverride: boolean;
    lastUpdated: string;
}
export interface BreakTheGlassEvent {
    id: string;
    patientId: string;
    practitionerId: string;
    requestingOrgId: string;
    emergencyReason: string;
    timestamp: string;
    auditHashSha256: string;
    isFlaggedForReview: boolean;
}
export declare class ConsentManager {
    private prisma;
    constructor(prisma?: PrismaClient);
    setConsent(directive: PatientConsentDirective): Promise<void>;
    getConsent(patientId: string): Promise<PatientConsentDirective>;
    evaluateAccess(patientId: string, requestingOrgId: string, category?: string): Promise<{
        isGranted: boolean;
        reason: string;
    }>;
    executeBreakTheGlass(patientId: string, practitionerId: string, requestingOrgId: string, emergencyReason: string): Promise<BreakTheGlassEvent>;
    getAllBreakGlassEvents(): Promise<BreakTheGlassEvent[]>;
    clearAll(): Promise<void>;
}
