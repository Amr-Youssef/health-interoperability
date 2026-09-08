import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';

export function createNphiesRoutes(canonicalStore: any, engine: any) {
  const router = Router();
  router.get('/nphies/financial-summary', verifyToken as any, requirePermission('CLAIM_MANAGE_ORG','ANALYTICS_READ_NATIONAL') as any, async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 5), 50);
    const skip = (page - 1) * limit;
    let coverages = await canonicalStore.getAllCoverages();
    let claims = await canonicalStore.getAllClaims();
    if (q) {
      const f = (s: string) => s.toLowerCase().includes(q);
      coverages = coverages.filter((c: any) => f(c.payerId||'') || f(c.policyNumber||'') || f(c.memberId||''));
      claims = claims.filter((c: any) => f(c.claimNumber||'') || f(c.patientId||'') || f(c.status||''));
    }
    const totalCoverages = coverages.length;
    const totalClaims = claims.length;
    coverages = coverages.slice(skip, skip+limit);
    claims = claims.slice(skip, skip+limit);
    const responses: any[] = [];
    for (const clm of claims) { const r = await canonicalStore.getClaimResponse(clm.internalId); if (r) responses.push(r); }
    res.json({ coverages, claims, claimResponses: responses, pagination: { page, pageSize: limit, totalCoverages, totalClaims } });
  });
  router.post('/nphies/eligibility/:patientId', verifyToken as any, requirePermission('CLAIM_MANAGE_ORG','PATIENT_READ_ORG','PATIENT_READ_ALL') as any, async (req, res) => {
    const eligibility = await engine.checkPatientEligibility(req.params.patientId as string);
    if (!eligibility) return res.status(404).json({ error: 'No active insurance coverage found for this patient.' });
    res.json({ success: true, eligibility });
  });
  return router;
}
