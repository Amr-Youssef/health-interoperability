import { prisma as defaultPrisma } from '../lib/prisma.js';
import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';

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

export class ConsentManager {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || defaultPrisma as unknown as PrismaClient;
  }

  async setConsent(directive: PatientConsentDirective): Promise<void> {
    await this.prisma.consent.upsert({
      where: { id: `consent-${directive.patientId}` },
      update: {
        consent_type: directive.policy,
        scope: JSON.stringify({
          allowedOrganizations: directive.allowedOrganizations,
          blockedCategories: directive.blockedCategories,
          allowEmergencyOverride: directive.allowEmergencyOverride
        }),
        granted_at: new Date(directive.lastUpdated),
        granted: true,
        consent_source: 'SYSTEM'
      },
      create: {
        id: `consent-${directive.patientId}`,
        patient_id: directive.patientId,
        consent_type: directive.policy,
        scope: JSON.stringify({
          allowedOrganizations: directive.allowedOrganizations,
          blockedCategories: directive.blockedCategories,
          allowEmergencyOverride: directive.allowEmergencyOverride
        }),
        granted_at: new Date(directive.lastUpdated),
        granted: true,
        consent_source: 'SYSTEM'
      }
    });
  }

  async getConsent(patientId: string): Promise<PatientConsentDirective> {
    // We try to find the patient first to satisfy foreign keys, if not present, we can't link, but for now we link blindly
    // Actually the schema requires patient_id to be a valid internal_id in Patient table.
    // If the patient doesn't exist yet, this will fail. Let's just catch it.
    try {
      const existing = await this.prisma.consent.findFirst({
        where: { patient_id: patientId }
      });

      if (existing) {
        const scope = JSON.parse(existing.scope || '{}');
        return {
          patientId: existing.patient_id,
          policy: existing.consent_type as ConsentPolicyType,
          allowedOrganizations: scope.allowedOrganizations || ['*'],
          blockedCategories: scope.blockedCategories || [],
          allowEmergencyOverride: scope.allowEmergencyOverride ?? true,
          lastUpdated: existing.granted_at.toISOString()
        };
      }
    } catch (err) {
      console.warn('Could not fetch consent from db, using default', err);
    }

    const baseline: PatientConsentDirective = {
      patientId,
      policy: 'EXPLICIT_PER_ENCOUNTER',
      allowedOrganizations: [],
      blockedCategories: [],
      allowEmergencyOverride: true,
      lastUpdated: new Date().toISOString()
    };
    
    try {
        await this.setConsent(baseline);
    } catch (e) {
        // Patient might not exist yet in Canonical store
    }
    
    return baseline;
  }

  async evaluateAccess(patientId: string, requestingOrgId: string, category: string = 'general'): Promise<{ isGranted: boolean; reason: string }> {
    const consent = await this.getConsent(patientId);

    if (consent.policy === 'OPT_IN_FULL') {
      if (consent.allowedOrganizations.length === 0) return { isGranted: false, reason: 'OPT_IN_FULL requires explicit organization list — denied by default.' };
      if (consent.allowedOrganizations.includes('*') || consent.allowedOrganizations.includes(requestingOrgId)) return { isGranted: true, reason: 'Patient consented to full exchange for this organization.' };
      return { isGranted: false, reason: 'Organization not in OPT_IN_FULL allow-list.' };
    }
    if (consent.policy === 'EXPLICIT_PER_ENCOUNTER') {
      return { isGranted: false, reason: 'EXPLICIT_PER_ENCOUNTER — access requires active Appointment + Consent per encounter.' };
    }

    if (consent.blockedCategories.includes(category)) {
      return { isGranted: false, reason: `Data category '${category}' is blocked by patient privacy directive.` };
    }

    if (consent.allowedOrganizations.includes('*') || consent.allowedOrganizations.includes(requestingOrgId)) {
      return { isGranted: true, reason: 'Organization is authorized by patient consent directive.' };
    }

    return { isGranted: false, reason: 'Access denied: requesting facility is not in the patient approved organization list.' };
  }

  async executeBreakTheGlass(
    patientId: string,
    practitionerId: string,
    requestingOrgId: string,
    emergencyReason: string
  ): Promise<BreakTheGlassEvent> {
    const timestamp = new Date().toISOString();
    
    const event = await this.prisma.auditLog.create({
      data: {
        entity_type: 'Patient',
        entity_id: patientId,
        action: 'BREAK_THE_GLASS',
        actor_id: practitionerId,
        details: emergencyReason,
        old_values: JSON.stringify({ requestingOrgId }),
        new_values: JSON.stringify({ isFlaggedForReview: true })
      }
    });

    const payload = `${event.id}:${patientId}:${practitionerId}:${requestingOrgId}:${emergencyReason}:${timestamp}`;
    const auditHashSha256 = crypto.createHash('sha256').update(payload).digest('hex');

    return {
      id: event.id,
      patientId,
      practitionerId,
      requestingOrgId,
      emergencyReason,
      timestamp,
      auditHashSha256,
      isFlaggedForReview: true
    };
  }

  async getAllBreakGlassEvents(): Promise<BreakTheGlassEvent[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { action: 'BREAK_THE_GLASS' }
    });
    return logs.map(event => {
      const oldV = JSON.parse(event.old_values || '{}');
      return {
        id: event.id,
        patientId: event.entity_id,
        practitionerId: event.actor_id || 'UNKNOWN',
        requestingOrgId: oldV.requestingOrgId || 'UNKNOWN',
        emergencyReason: event.details || '',
        timestamp: event.created_at.toISOString(),
        auditHashSha256: crypto.createHash('sha256').update(`${event.id}:${event.entity_id}:${event.actor_id}:${oldV.requestingOrgId}:${event.details}:${event.created_at.toISOString()}`).digest('hex'),
        isFlaggedForReview: true
      };
    });
  }

  async clearAll(): Promise<void> {
    await this.prisma.consent.deleteMany();
    await this.prisma.auditLog.deleteMany({ where: { action: 'BREAK_THE_GLASS' } });
  }
}
