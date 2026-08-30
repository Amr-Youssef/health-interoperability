import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
export class SmartOnFhirAuthService {
    prisma;
    baseUrl;
    constructor(prisma, baseUrl = 'http://localhost:3000') {
        this.prisma = prisma || new PrismaClient();
        this.baseUrl = baseUrl;
    }
    getSmartConfiguration() {
        return {
            issuer: this.baseUrl,
            authorization_endpoint: `${this.baseUrl}/oauth/authorize`,
            token_endpoint: `${this.baseUrl}/oauth/token`,
            introspection_endpoint: `${this.baseUrl}/oauth/introspect`,
            capabilities: [
                'launch-ehr',
                'launch-standalone',
                'client-public',
                'client-confidential-symmetric',
                'context-ehr-patient',
                'context-standalone-patient',
                'permission-patient',
                'permission-user'
            ],
            scopes_supported: [
                'openid',
                'profile',
                'launch',
                'launch/patient',
                'patient/*.read',
                'patient/Patient.read',
                'patient/Encounter.read',
                'patient/Condition.read',
                'patient/Observation.read',
                'patient/MedicationRequest.read',
                'patient/Immunization.read',
                'patient/Coverage.read',
                'patient/Claim.read',
                'user/*.read'
            ],
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'client_credentials'],
            code_challenge_methods_supported: ['S256']
        };
    }
    async issueToken(params) {
        const accessToken = `smart_tok_${crypto.randomBytes(24).toString('hex')}`;
        const expiresIn = 3600; // 1 hour
        const scope = params.scope || 'launch/patient patient/*.read openid profile';
        const patient = params.patientId || '1088445566';
        await this.prisma.smartToken.create({
            data: {
                token: accessToken,
                client_id: params.clientId,
                patient_id: patient,
                scope,
                expires_at: new Date(Date.now() + (expiresIn * 1000))
            }
        });
        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            scope,
            patient,
            need_patient_banner: true
        };
    }
    async verifyToken(token) {
        const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
        const tokenInfo = await this.prisma.smartToken.findUnique({
            where: { token: cleanToken }
        });
        if (!tokenInfo) {
            return { isValid: false };
        }
        if (new Date() > tokenInfo.expires_at) {
            await this.prisma.smartToken.delete({ where: { token: cleanToken } });
            return { isValid: false };
        }
        return {
            isValid: true,
            patientId: tokenInfo.patient_id || undefined,
            scope: tokenInfo.scope,
            clientId: tokenInfo.client_id
        };
    }
}
//# sourceMappingURL=smart-auth.js.map