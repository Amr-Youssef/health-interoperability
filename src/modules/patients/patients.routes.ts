import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';
import { prisma } from '../../lib/prisma.js';

async function resolvePatientInternalId(user: any, canonicalStore: any): Promise<string | null> {
  if (!user) return null;
  if (user.patient_profile_id) {
    const p = await canonicalStore.getPatient(user.patient_profile_id);
    if (p) return p.internalId;
  }
  const byNid = await canonicalStore.findPatientByIdentifier(user.username);
  if (byNid) return byNid.internalId;
  if (user.username === 'patient') {
    const demo = await canonicalStore.findPatientByIdentifier('1088445566');
    if (demo) return demo.internalId;
    const all = await canonicalStore.getAllPatients();
    if (all.length > 0) return all[0].internalId;
  }
  return user.patient_profile_id || null;
}

export function createPatientsRoutes(canonicalStore: any) {
  const router = Router();
  router.get('/patients/search', verifyToken as any, requirePermission('PATIENT_READ_SELF','PATIENT_READ_ORG','PATIENT_READ_ALL','FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req, res) => {
    const user: any = (req as any).user;
    if (user.role?.role_code === 'PATIENT') {
      const targetId = await resolvePatientInternalId(user, canonicalStore);
      if (targetId) {
        const p = await canonicalStore.getPatient(targetId) || await canonicalStore.findPatientByIdentifier(targetId);
        return res.json({ items: p ? [p] : [], total: p ? 1 : 0, page: 1, pageSize: 1 });
      }
      return res.json({ items: [], total: 0, page: 1, pageSize: 1 });
    }
    const q = String(req.query.q || '').trim();
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 5), 50);
    const sort = String(req.query.sort || 'recent');
    const skip = (page - 1) * limit;
    try {
      const { items, total } = await (canonicalStore as any).searchPatients({ q, skip, take: limit, sort });
      res.setHeader('Cache-Control', 'no-cache');
      res.json({ items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit), query: q });
    } catch (e: any) { res.status(500).json({ error: 'Search failed', details: e.message }); }
  });
  router.get('/patients', verifyToken as any, requirePermission('PATIENT_READ_SELF','PATIENT_READ_ORG','PATIENT_READ_ALL','FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req, res) => {
    const user: any = (req as any).user;
    if (user && user.role?.role_code === 'PATIENT') {
      const targetId = await resolvePatientInternalId(user, canonicalStore);
      if (targetId) {
        const p = await canonicalStore.getPatient(targetId) || await canonicalStore.findPatientByIdentifier(targetId);
        if (p) return res.json([p]);
      }
      return res.json([]);
    }
    if (req.query.q || req.query.page || req.query.limit) {
      const q = String(req.query.q || '').trim();
      const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 5), 50);
      const skip = (page - 1) * limit;
      const { items, total } = await (canonicalStore as any).searchPatients({ q, skip, take: limit, sort: String(req.query.sort || 'recent') });
      return res.json({ items, total, page, pageSize: limit });
    }
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 100);
    const { items } = await (canonicalStore as any).searchPatients({ q: '', skip: 0, take: limit, sort: 'recent' });
    res.json(items);
  });
  router.get('/patients/:id/longitudinal', verifyToken as any, requirePermission('PATIENT_READ_SELF','PATIENT_READ_ORG','PATIENT_READ_ALL','FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req, res) => {
    const user: any = (req as any).user;
    const requestedId = req.params.id as string;
    if (user && user.role?.role_code === 'PATIENT') {
      const targetId = await resolvePatientInternalId(user, canonicalStore);
      let allowed = false;
      if (targetId) {
        const targetPatient = await canonicalStore.getPatient(targetId);
        if (targetId === requestedId || (targetPatient && (targetPatient.internalId === requestedId || targetPatient.identifiers?.some((i: any) => i.value === requestedId)))) allowed = true;
      }
      if (!allowed) return res.status(403).json({ error: 'Access denied: You can only view your own longitudinal health record.' });
    }
    if (user && ['HOSPITAL_ADMIN','CLINICIAN'].includes(user.role?.role_code)) {
      const prismaCheck: any = prisma;
      const pidCandidates = [requestedId];
      let patientInternalId: string | null = requestedId;
      try {
        const patByInternal = await prismaCheck.patient.findFirst({ where: { internal_id: requestedId } });
        if (patByInternal) { pidCandidates.push(patByInternal.internal_id, patByInternal.id); patientInternalId = patByInternal.internal_id; }
        const patById = await prismaCheck.patient.findFirst({ where: { id: requestedId } });
        if (patById) { pidCandidates.push(patById.internal_id, patById.id); patientInternalId = patById.internal_id; }
      } catch {}
      const uniquePids = [...new Set(pidCandidates)];
      const orgLink = await prismaCheck.patientOrganization.findFirst({ where: { organization_id: user.organization_id, active: true, patient: { internal_id: { in: uniquePids } } } }).catch(()=>null);
      const directPatient = await prismaCheck.patient.findFirst({ where: { internal_id: { in: uniquePids }, source_system_id: user.organization_id } }).catch(()=>null);
      if (!orgLink && !directPatient) {
        const appt = await prismaCheck.appointment.findFirst({ where: { patient_id: { in: uniquePids }, organization_id: user.organization_id, status: { in: ['booked','arrived','fulfilled'] } }, include: { consent: true } });
        const hasValidConsent = appt?.consent && appt.consent.granted && !appt.consent.revoked_at && (!appt.consent.expires_at || new Date(appt.consent.expires_at) > new Date());
        if (!appt || !hasValidConsent) return res.status(403).json({ error: 'لا يوجد موعد/إذن نشط ولا ارتباط منشأة لهذا المريض - احجز موعد (المواعيد والكشف) وانتظر تأكيد المنشأة، أو استخدم كسر الزجاج للطوارئ. المرضى المرتبطون سابقاً (PatientOrganization) يبقون متاحين.' });
        if (user.role?.role_code === 'CLINICIAN' && appt.clinician_id && appt.clinician_id !== user.id) return res.status(403).json({ error: 'الموعد مرتبط بطبيب آخر - فقط الطبيب المتابع يملك صلاحية القراءة' });
      }
    }
    const record = await canonicalStore.getLongitudinalRecord(requestedId);
    if (!record) return res.status(404).json({ error: 'Patient not found' });
    res.json(record);
  });
  return router;
}
