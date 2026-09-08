import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';
export function createCdsRoutes(engine) {
    const router = Router();
    router.get('/cds/patient/:id/safety-alerts', verifyToken, requirePermission('CLINICAL_READ_ALL'), async (req, res) => {
        try {
            res.json(await engine.cdsEngine.evaluateMedicationSafety(req.params.id));
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    router.post('/cds/evaluate-draft-prescription', verifyToken, requirePermission('CLINICAL_WRITE_ORG', 'CLINICAL_READ_ALL'), async (req, res) => {
        try {
            res.json(await engine.cdsEngine.evaluateDraftPrescription(req.body));
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    return router;
}
//# sourceMappingURL=cds.routes.js.map