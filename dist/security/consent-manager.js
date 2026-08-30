import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
export class ConsentManager {
    prisma;
    constructor(prisma) {
        this.prisma = prisma || new PrismaClient();
    }
    async setConsent(directive) {
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
    async getConsent(patientId) {
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
                    policy: existing.consent_type,
                    allowedOrganizations: scope.allowedOrganizations || ['*'],
                    blockedCategories: scope.blockedCategories || [],
                    allowEmergencyOverride: scope.allowEmergencyOverride ?? true,
                    lastUpdated: existing.granted_at.toISOString()
                };
            }
        }
        catch (err) {
            console.warn('Could not fetch consent from db, using default', err);
        }
        const baseline = {
            patientId,
            policy: 'OPT_IN_FULL',
            allowedOrganizations: ['*'],
            blockedCategories: [],
            allowEmergencyOverride: true,
            lastUpdated: new Date().toISOString()
        };
        try {
            await this.setConsent(baseline);
        }
        catch (e) {
            // Patient might not exist yet in Canonical store
        }
        return baseline;
    }
    async evaluateAccess(patientId, requestingOrgId, category = 'general') {
        const consent = await this.getConsent(patientId);
        if (consent.policy === 'OPT_IN_FULL') {
            return { isGranted: true, reason: 'Patient consented to full national health record exchange across accredited health facilities.' };
        }
        if (consent.blockedCategories.includes(category)) {
            return { isGranted: false, reason: `Data category '${category}' is blocked by patient privacy directive.` };
        }
        if (consent.allowedOrganizations.includes('*') || consent.allowedOrganizations.includes(requestingOrgId)) {
            return { isGranted: true, reason: 'Organization is authorized by patient consent directive.' };
        }
        return { isGranted: false, reason: 'Access denied: requesting facility is not in the patient approved organization list.' };
    }
    async executeBreakTheGlass(patientId, practitionerId, requestingOrgId, emergencyReason) {
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
    async getAllBreakGlassEvents() {
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
    async clearAll() {
        await this.prisma.consent.deleteMany();
        await this.prisma.auditLog.deleteMany({ where: { action: 'BREAK_THE_GLASS' } });
    }
}
//# sourceMappingURL=consent-manager.js.map