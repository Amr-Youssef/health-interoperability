import { prisma as defaultPrisma } from '../lib/prisma.js';
import crypto from 'crypto';
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

export class SmartOnFhirAuthService {
  private prisma: PrismaClient;
  private baseUrl: string;

  constructor(prisma?: PrismaClient, baseUrl: string = 'http://localhost:3000') {
    this.prisma = prisma || defaultPrisma as unknown as PrismaClient;
    this.baseUrl = baseUrl;
  }

  getSmartConfiguration(): SmartConfiguration {
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

  private readonly allowedScopes = new Set(this.getSmartConfiguration().scopes_supported);

  async issueToken(params: {
    clientId: string;
    grantType: string;
    scope?: string;
    patientId?: string;
    clientSecret?: string;
  }): Promise<SmartTokenResponse> {
    const allowedClients = (process.env.SMART_CLIENT_SECRETS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allowedClients.length > 0 && params.clientSecret) {
      const expected = process.env[`SMART_SECRET_${params.clientId}`] || allowedClients[0];
      if (params.clientSecret !== expected) throw new Error('Invalid client_secret');
    } else if (process.env.NODE_ENV === 'production' && !params.clientId) {
      throw new Error('client_id required');
    }
    const requestedScopes = (params.scope || 'launch/patient patient/*.read openid profile').split(/\s+/).filter(Boolean);
    for (const s of requestedScopes) if (!this.allowedScopes.has(s) && !s.startsWith('patient/') && !s.startsWith('user/')) throw new Error(`Scope not supported: ${s}`);
    const scope = requestedScopes.join(' ');
    const accessToken = `smart_tok_${crypto.randomBytes(24).toString('hex')}`;
    const expiresIn = 3600;
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

  async verifyToken(token: string): Promise<{ isValid: boolean; patientId?: string; scope?: string; clientId?: string }> {
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
