import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';
export function createHl7Routes(engine) {
    const router = Router();
    router.post('/hl7v2/ingest', verifyToken, requirePermission('IMPORT_EXECUTE_ORG'), async (req, res) => {
        try {
            const rawHl7 = typeof req.body === 'string' ? req.body : req.body.message || req.body.rawHl7;
            if (!rawHl7)
                return res.status(400).json({ error: 'HL7 v2 pipe-delimited message is required.' });
            const result = await engine.ingestHl7v2Message(rawHl7);
            res.json({ success: true, message: `HL7 v2 [${result.parsed.messageType}^${result.parsed.triggerEvent}] processed and normalized successfully.`, result });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    return router;
}
//# sourceMappingURL=hl7.routes.js.map