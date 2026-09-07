import { Router } from 'express';
import rateLimit from 'express-rate-limit';

export function createSmartRoutes(engine: any) {
  const router = Router();
  const DISABLE_RATE_LIMIT = process.env.DISABLE_RATE_LIMIT === 'true' && process.env.NODE_ENV !== 'production';
  const oauthLimiter: any = DISABLE_RATE_LIMIT ? ((req: any, _res: any, next: any) => next()) : rateLimit({ windowMs: 15*60*1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'محاولات OAuth كثيرة - حاول بعد 15 دقيقة' } });
  router.get('/.well-known/smart-configuration', (req, res) => { res.json(engine.smartAuth.getSmartConfiguration()); });
  router.post('/oauth/token', oauthLimiter as any, async (req, res) => {
    const { client_id, client_secret, grant_type, scope, patient_id } = req.body;
    try {
      const tokenResponse = await engine.smartAuth.issueToken({ clientId: client_id || 'sehhaty-patient-portal', clientSecret: client_secret, grantType: grant_type || 'authorization_code', scope: scope || 'launch/patient patient/*.read openid profile', patientId: patient_id || '1088445566' });
      await engine.auditChain.recordEvent('QUERY', client_id || 'sehhaty-app', 'SmartOAuthToken', tokenResponse.access_token.substring(0, 16), `Issued SMART on FHIR access token for patient [${tokenResponse.patient}]`);
      res.json(tokenResponse);
    } catch (e: any) { return res.status(400).json({ error: e.message }); }
  });
  router.post('/oauth/introspect', oauthLimiter as any, async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ active: false });
    const v = await engine.smartAuth.verifyToken(token);
    res.json({ active: v.isValid, scope: v.scope, client_id: v.clientId, patient: v.patientId });
  });
  return router;
}
