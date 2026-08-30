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
    private persistPath;
    private consents;
    private breakGlassLog;
    constructor(persistPath?: string | null);
    private saveToDisk;
    private loadFromDisk;
    setConsent(directive: PatientConsentDirective): void;
    getConsent(patientId: string): PatientConsentDirective;
    evaluateAccess(patientId: string, requestingOrgId: string, category?: string): {
        isGranted: boolean;
        reason: string;
    };
    executeBreakTheGlass(patientId: string, practitionerId: string, requestingOrgId: string, emergencyReason: string): BreakTheGlassEvent;
    getAllBreakGlassEvents(): BreakTheGlassEvent[];
    clearAll(): void;
}
