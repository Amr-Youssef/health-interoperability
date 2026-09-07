import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

export function createPublicRoutes() {
  const router = Router();
  router.get('/public/organizations', async (req, res) => {
    try {
      const orgs = await prisma.organization.findMany({ where: { status: 'ACTIVE', NOT: { organization_type: 'MOH' } }, select: { id: true, organization_name: true, organization_name_ar: true, organization_type: true, region: true, status: true }, orderBy: { organization_name_ar: 'asc' } });
      res.json(orgs);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  router.get('/public/clinicians', async (req, res) => {
    try {
      const orgId = req.query.organization_id as string;
      if (!orgId) return res.status(400).json({ error: 'organization_id required' });
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org || org.status !== 'ACTIVE') return res.status(403).json({ error: 'Organization not active' });
      const clinicians = await prisma.user.findMany({ where: { organization_id: orgId, is_active: true, role: { role_code: 'CLINICIAN' } }, select: { id: true, username: true, full_name: true, email: true }, orderBy: { full_name: 'asc' } });
      res.json(clinicians);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  return router;
}
