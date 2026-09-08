import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';

export function createCdsRoutes(engine: any) {
  const router = Router();
  router.get('/cds/patient/:id/safety-alerts', verifyToken as any, requirePermission('CLINICAL_READ_ALL') as any, async (req, res) => {
    try { res.json(await engine.cdsEngine.evaluateMedicationSafety(req.params.id as string)); } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });
  router.post('/cds/evaluate-draft-prescription', verifyToken as any, requirePermission('CLINICAL_WRITE_ORG','CLINICAL_READ_ALL') as any, async (req, res) => {
    try { res.json(await engine.cdsEngine.evaluateDraftPrescription(req.body)); } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });
  return router;
}
