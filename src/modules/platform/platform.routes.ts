import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';

export function createPlatformRoutes(engine: any) {
  const router = Router();
  router.post('/pipeline/run', verifyToken as any, requirePermission('ORG_MANAGE_ALL','POLICY_MANAGE') as any, async (req, res) => {
    try { const result = await engine.runFullIngestionPipeline(); res.json({ success: true, message: 'Pipeline executed successfully across all heterogeneous source systems.', data: result }); } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });
  router.get('/monitoring/stats', verifyToken as any, requirePermission('ANALYTICS_READ_NATIONAL','AUDIT_READ_CENTRAL') as any, async (req, res) => {
    const auditLimit = Math.min(Math.max(parseInt(String(req.query.auditLimit || '15'), 10) || 15, 5), 50);
    const stats = await engine.getIntegrationMonitoringStats(auditLimit);
    res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
    res.json(stats);
  });
  return router;
}
