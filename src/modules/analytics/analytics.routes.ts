import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';

export function createAnalyticsRoutes(engine: any) {
  const router = Router();
  router.get('/analytics/population-health', verifyToken as any, requirePermission('ANALYTICS_READ_NATIONAL','ANALYTICS_READ_ORG') as any, async (req, res) => {
    try { res.json(await engine.populationHealth.calculateMetrics()); } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });
  router.get('/analytics/weqaa/reportable-cases', verifyToken as any, requirePermission('ANALYTICS_READ_NATIONAL','ANALYTICS_READ_ORG') as any, async (req, res) => {
    try { res.json(await engine.weqaaSurveillance.detectReportableCases()); } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });
  router.get('/analytics/weqaa/bundle/:caseId', verifyToken as any, requirePermission('ANALYTICS_READ_NATIONAL','ANALYTICS_READ_ORG') as any, async (req, res) => {
    try { res.json(await engine.weqaaSurveillance.generateWeqaaNotificationBundle(req.params.caseId as string)); } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });
  router.post('/analytics/weqaa/dispatch/:caseId', verifyToken as any, requirePermission('ANALYTICS_READ_NATIONAL') as any, async (req, res) => {
    try {
      const result = await engine.weqaaSurveillance.dispatchCaseNotification(req.params.caseId as string);
      await engine.auditChain.recordEvent('PUBLIC_HEALTH_NOTIFICATION' as any,'WEQAA_SURVEILLANCE_ROBOT','WeqaaReportableCase',result.caseId,`Dispatched communicable disease notification [${result.diseaseName}] to Weqaa. Tracking: ${result.weqaaTrackingNumber}`);
      res.json({ success: true, message: `Notification for [${result.diseaseNameAr}] dispatched to Weqaa command center successfully.`, case: result });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });
  return router;
}
