import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';

export function createSecurityRoutes(engine: any) {
  const router = Router();
  router.get('/security/consent/:patientId', verifyToken as any, requirePermission('CONSENT_MANAGE_SELF','CONSENT_OVERRIDE','PATIENT_READ_ORG','PATIENT_READ_ALL') as any, async (req, res) => {
    res.json(await engine.consentManager.getConsent(req.params.patientId as string));
  });
  router.post('/security/break-glass', verifyToken as any, requirePermission('BREAK_GLASS_EXECUTE') as any, async (req, res) => {
    const { patientId, practitionerId, requestingOrgId, emergencyReason } = req.body;
    if (!patientId || !practitionerId || !emergencyReason) return res.status(400).json({ error: 'Patient ID, Practitioner ID, and Emergency Reason are mandatory.' });
    const event = await engine.consentManager.executeBreakTheGlass(patientId, practitionerId, requestingOrgId || 'HOSP-EMERGENCY', emergencyReason);
    await engine.auditChain.recordEvent('BREAK_GLASS', practitionerId, 'Patient', patientId, `Break-the-Glass activated: ${emergencyReason}`);
    res.json({ success: true, event });
  });
  router.get('/security/break-glass/logs', verifyToken as any, requirePermission('AUDIT_READ_CENTRAL','AUDIT_READ_ORG') as any, async (req, res) => {
    res.json(await engine.consentManager.getAllBreakGlassEvents());
  });
  router.get('/security/audit-chain', verifyToken as any, requirePermission('AUDIT_READ_CENTRAL','AUDIT_READ_ORG') as any, async (req, res) => {
    res.json(await engine.auditChain.getRecentEvents(50));
  });
  router.get('/security/audit-chain/verify', verifyToken as any, requirePermission('AUDIT_READ_CENTRAL','AUDIT_READ_ORG') as any, async (req, res) => {
    res.json(await engine.auditChain.verifyChainIntegrity());
  });
  return router;
}
