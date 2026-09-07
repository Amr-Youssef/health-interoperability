import type { PrismaClient } from '@prisma/client';
export interface SmartTokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope: string;
    patient?: string;
    need_patient_banner?: boolean;
    smart_style_url?: string;
}
export interface SmartConfiguration {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    introspection_endpoint: string;
    capabilities: string[];
    scopes_supported: string[];
    response_types_supported: string[];
    grant_types_supported: string[];
    code_challenge_methods_supported: string[];
}
export declare class SmartOnFhirAuthService {
    private prisma;
    private baseUrl;
    constructor(prisma?: PrismaClient, baseUrl?: string);
    getSmartConfiguration(): SmartConfiguration;
    private readonly allowedScopes;
    issueToken(params: {
        clientId: string;
        grantType: string;
        scope?: string;
        patientId?: string;
        clientSecret?: string;
    }): Promise<SmartTokenResponse>;
    verifyToken(token: string): Promise<{
        isValid: boolean;
        patientId?: string;
        scope?: string;
        clientId?: string;
    }>;
}
