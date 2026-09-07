import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';

export function createNphiesRoutes(canonicalStore: any, engine: any) {
  const router = Router();
  router.get('/nphies/financial-summary', verifyToken as any, requirePermission('CLAIM_MANAGE_ORG','ANALYTICS_READ_NATIONAL') as any, async (req, res) => {
    const coverages = await canonicalStore.getAllCoverages();
    const claims = await canonicalStore.getAllClaims();
    const responses: any[] = [];
    for (const clm of claims) { const r = await canonicalStore.getClaimResponse(clm.internalId); if (r) responses.push(r); }
    res.json({ coverages, claims, claimResponses: responses });
  });
  router.post('/nphies/eligibility/:patientId', verifyToken as any, requirePermission('CLAIM_MANAGE_ORG','PATIENT_READ_ORG','PATIENT_READ_ALL') as any, async (req, res) => {
    const eligibility = await engine.checkPatientEligibility(req.params.patientId as string);
    if (!eligibility) return res.status(404).json({ error: 'No active insurance coverage found for this patient.' });
    res.json({ success: true, eligibility });
  });
  return router;
}
