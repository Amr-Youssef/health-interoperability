import crypto from 'crypto';
export class SmartOnFhirAuthService {
    validTokens = new Map();
    baseUrl;
    constructor(baseUrl = 'http://localhost:3000') {
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
    issueToken(params) {
        const accessToken = `smart_tok_${crypto.randomBytes(24).toString('hex')}`;
        const expiresIn = 3600; // 1 hour
        const scope = params.scope || 'launch/patient patient/*.read openid profile';
        const patient = params.patientId || '1088445566';
        this.validTokens.set(accessToken, {
            patientId: patient,
            scope,
            expiresAt: Date.now() + (expiresIn * 1000),
            clientId: params.clientId
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
    verifyToken(token) {
        const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
        const tokenInfo = this.validTokens.get(cleanToken);
        if (!tokenInfo) {
            return { isValid: false };
        }
        if (Date.now() > tokenInfo.expiresAt) {
            this.validTokens.delete(cleanToken);
            return { isValid: false };
        }
        return {
            isValid: true,
            patientId: tokenInfo.patientId,
            scope: tokenInfo.scope,
            clientId: tokenInfo.clientId
        };
    }
}
//# sourceMappingURL=smart-auth.js.map