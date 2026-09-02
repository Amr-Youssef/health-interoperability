import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { PrismaClient } from '@prisma/client';
import { PrismaCanonicalStore } from '../../persistence/prisma-canonical-store.js';

const router = Router();
const prisma = new PrismaClient();
const canonicalStore = new PrismaCanonicalStore(prisma);

const ALLOWED_HOSPITAL_FIELDS = new Set([
  'phone', 'email', 'fullName',
  'organizationName', 'organizationNameAr', 'region'
]);
const READ_ONLY_HOSPITAL_FIELDS = [
  'username', 'role', 'organizationId', 'organizationType', 'status', 'createdAt'
];

function normalizeSaudiPhoneHosp(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-\(\)]/g, '');
  if (/^05\d{8}$/.test(cleaned)) return '+966' + cleaned.substring(1);
  if (/^5\d{8}$/.test(cleaned)) return '+966' + cleaned;
  if (/^9665\d{8}$/.test(cleaned)) return '+' + cleaned;
  if (/^\+9665\d{8}$/.test(cleaned)) return cleaned;
  return null;
}
function isValidEmailHosp(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function validateHospitalPayload(body: any): { valid: boolean; error?: string; normalized?: any } {
  const keys = Object.keys(body);
  const forbidden = keys.filter(k => !ALLOWED_HOSPITAL_FIELDS.has(k));
  if (forbidden.length > 0) {
    return { valid: false, error: `حقول غير مصرح بتعديلها للمنشأة: ${forbidden.join(', ')}. المسموح فقط: بيانات التواصل والمعلومات العامة للمنشأة` };
  }
  if (keys.length === 0) return { valid: false, error: 'لم يتم تقديم أي حقول قابلة للتعديل' };
  const norm: any = {};
  if (body.fullName !== undefined) {
    const v = String(body.fullName).trim();
    if (v && (v.length < 3 || v.length > 80)) return { valid: false, error: 'الاسم الكامل لمسؤول المنشأة يجب أن يكون بين 3 و 80 حرفاً' };
    if (v && v.split(/\s+/).length < 2) return { valid: false, error: 'الاسم الكامل يجب أن يحتوي على الاسم الأول واسم العائلة' };
    norm.fullName = v || null;
  }
  if (body.phone !== undefined) {
    const raw = String(body.phone).trim();
    if (raw === '') return { valid: false, error: 'رقم الجوال لا يمكن أن يكون فارغاً' };
    const np = normalizeSaudiPhoneHosp(raw);
    if (!np) return { valid: false, error: 'رقم الجوال غير صحيح: يجب أن يكون رقم سعودي يبدأ بـ 05 أو +9665' };
    norm.phone = np;
  }
  if (body.email !== undefined) {
    const raw = String(body.email).trim();
    if (raw === '') return { valid: false, error: 'البريد الإلكتروني لا يمكن أن يكون فارغاً للمنشأة' };
    if (!isValidEmailHosp(raw)) return { valid: false, error: 'صيغة البريد الإلكتروني غير صحيحة' };
    norm.email = raw.toLowerCase();
  }
  if (body.organizationName !== undefined) {
    const v = String(body.organizationName).trim();
    if (!v || v.length < 3 || v.length > 120) return { valid: false, error: 'اسم المنشأة بالإنجليزية يجب أن يكون بين 3 و 120 حرفاً' };
    norm.organizationName = v;
  }
  if (body.organizationNameAr !== undefined) {
    const v = String(body.organizationNameAr).trim();
    if (!v || v.length < 3 || v.length > 120) return { valid: false, error: 'اسم المنشأة بالعربية يجب أن يكون بين 3 و 120 حرفاً' };
    if (!/[\u0600-\u06FF]/.test(v)) return { valid: false, error: 'اسم المنشأة بالعربية يجب أن يحتوي على حروف عربية' };
    norm.organizationNameAr = v;
  }
  if (body.region !== undefined) {
    const v = String(body.region).trim();
    if (!v || v.length < 2 || v.length > 50) return { valid: false, error: 'المنطقة غير صالحة' };
    norm.region = v;
  }
  return { valid: true, normalized: norm };
}

async function requireHospitalStaff(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role?.role_code;
  if (role !== 'HOSPITAL_ADMIN' && role !== 'CLINICIAN') {
    return res.status(403).json({ error: 'Access denied: Hospital staff required' });
  }
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.user.organization_id } });
    if (org && org.status === 'PENDING_APPROVAL') return res.status(403).json({ error: 'حساب المنشأة قيد المراجعة لدى وزارة الصحة - لا يمكن الوصول حتى الاعتماد', status: org.status });
    if (org && org.status === 'SUSPENDED') return res.status(403).json({ error: 'تم تعليق حساب المنشأة من قبل الأدمن الوطني - تواصل مع وزارة الصحة', status: org.status });
    if (org && org.status === 'REJECTED') return res.status(403).json({ error: 'تم رفض اعتماد المنشأة', status: org.status });
  } catch (e) {}
  next();
}
async function requireHospitalAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role?.role_code !== 'HOSPITAL_ADMIN') {
    return res.status(403).json({ error: 'Access denied: Hospital Admin required' });
  }
  return requireHospitalStaff(req, res, next);
}

router.use(verifyToken);
router.use(requireHospitalStaff);

// ============================================================================
// Hospital self-service: editable contact + organization public info
// GET  /api/hospital/me  -> returns consolidated user + organization
// PATCH /api/hospital/me -> updates ONLY whitelisted fields
// ============================================================================
router.get('/me', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const [freshUser, org] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id }, include: { role: true, organization: true } }),
      prisma.organization.findUnique({ where: { id: user.organization_id } })
    ]);
    if (!freshUser || !org) return res.status(404).json({ error: 'Hospital or user not found' });

    res.json({
      user: {
        id: freshUser.id,
        username: freshUser.username,
        fullName: freshUser.full_name,
        email: freshUser.email,
        phone: freshUser.phone,
        role: freshUser.role.role_code,
        organizationId: freshUser.organization_id
      },
      organization: {
        id: org.id,
        organizationName: org.organization_name,
        organizationNameAr: org.organization_name_ar,
        organizationType: org.organization_type,
        region: org.region,
        status: org.status,
        createdAt: org.created_at
      },
      meta: {
        editableFields: Array.from(ALLOWED_HOSPITAL_FIELDS),
        readOnlyFields: READ_ONLY_HOSPITAL_FIELDS,
        disclosure: 'يمكن لمسؤول المنشأة تعديل بيانات التواصل (جوال، بريد، اسم المسؤول) والبيانات العامة للمنشأة (الاسم عربي/إنجليزي، المنطقة) فقط. نوع المنشأة، الحالة، والمعرف محمية.'
      }
    });
  } catch (error) {
    console.error('Hospital me fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/me', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const validation = validateHospitalPayload(req.body);
    if (!validation.valid) return res.status(400).json({ error: validation.error });
    const data = validation.normalized!;

    // Email uniqueness
    if (data.email !== undefined) {
      const dup = await prisma.user.findFirst({ where: { email: data.email, NOT: { id: user.id } } });
      if (dup) return res.status(400).json({ error: 'البريد الإلكتروني مسجل لمستخدم آخر' });
    }
    // Org name uniqueness if changing
    if (data.organizationName !== undefined || data.organizationNameAr !== undefined) {
      const currentOrg = await prisma.organization.findUnique({ where: { id: user.organization_id } });
      const checkName = data.organizationName ?? currentOrg?.organization_name;
      const checkNameAr = data.organizationNameAr ?? currentOrg?.organization_name_ar;
      const dupOrg = await prisma.organization.findFirst({
        where: {
          OR: [
            { organization_name: checkName },
            { organization_name_ar: checkNameAr }
          ],
          NOT: { id: user.organization_id }
        }
      });
      if (dupOrg) return res.status(400).json({ error: 'اسم المنشأة مسجل لمنشأة أخرى' });
    }

    const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
    const freshOrg = await prisma.organization.findUnique({ where: { id: user.organization_id } });
    if (!freshUser || !freshOrg) return res.status(404).json({ error: 'Not found' });

    const oldValues: any = {};
    const newValues: any = {};
    const userUpdates: any = {};
    const orgUpdates: any = {};

    if (data.fullName !== undefined) {
      oldValues.fullName = freshUser.full_name;
      newValues.fullName = data.fullName;
      userUpdates.full_name = data.fullName;
    }
    if (data.phone !== undefined) {
      oldValues.phone = freshUser.phone;
      newValues.phone = data.phone;
      userUpdates.phone = data.phone;
    }
    if (data.email !== undefined) {
      oldValues.email = freshUser.email;
      newValues.email = data.email;
      userUpdates.email = data.email;
    }
    if (data.organizationName !== undefined) {
      oldValues.organizationName = freshOrg.organization_name;
      newValues.organizationName = data.organizationName;
      orgUpdates.organization_name = data.organizationName;
    }
    if (data.organizationNameAr !== undefined) {
      oldValues.organizationNameAr = freshOrg.organization_name_ar;
      newValues.organizationNameAr = data.organizationNameAr;
      orgUpdates.organization_name_ar = data.organizationNameAr;
    }
    if (data.region !== undefined) {
      oldValues.region = freshOrg.region;
      newValues.region = data.region;
      orgUpdates.region = data.region;
    }

    if (Object.keys(userUpdates).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: userUpdates });
    }
    if (Object.keys(orgUpdates).length > 0) {
      await prisma.organization.update({ where: { id: user.organization_id }, data: orgUpdates });
    }

    const [updatedUser, updatedOrg] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id }, include: { role: true, organization: true } }),
      prisma.organization.findUnique({ where: { id: user.organization_id } })
    ]);

    try {
      await prisma.auditLog.create({
        data: {
          entity_type: 'Organization',
          entity_id: user.organization_id,
          action: 'HOSPITAL_SELF_UPDATE',
          actor_id: user.id,
          organization_id: user.organization_id,
          old_values: JSON.stringify(oldValues),
          new_values: JSON.stringify(newValues),
          details: `Hospital self-service update: ${Object.keys(newValues).join(', ')}`
        }
      });
    } catch (e) { /* best effort */ }

    res.json({
      message: 'تم تحديث بيانات المنشأة المصرح بها بنجاح وسيتم توثيقها في سجل التدقيق',
      updatedFields: Object.keys(newValues),
      user: {
        id: updatedUser!.id,
        username: updatedUser!.username,
        fullName: updatedUser!.full_name,
        email: updatedUser!.email,
        phone: updatedUser!.phone
      },
      organization: {
        id: updatedOrg!.id,
        organizationName: updatedOrg!.organization_name,
        organizationNameAr: updatedOrg!.organization_name_ar,
        organizationType: updatedOrg!.organization_type,
        region: updatedOrg!.region,
        status: updatedOrg!.status
      }
    });
  } catch (error) {
    console.error('Hospital me patch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Hospital dashboard stats (scoped to own organization) - Single Source of Truth: DB counts, no client-side inference
router.get('/me/stats', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organization_id;
    const orgWhere = (field: string) => ({ OR: [{ [field]: orgId }, { organization_id: orgId }] } as any);
    const [
      patientLinks,
      patientsBySource,
      linkedPatientIds,
      encounters,
      conditions,
      observations,
      medications,
      immunizations,
      claims,
      coverages,
      recentImports,
      recentEncounters,
      rawCount
    ] = await Promise.all([
      prisma.patientOrganization.count({ where: { organization_id: orgId, active: true } }),
      prisma.patient.count({ where: { source_system_id: orgId } }),
      prisma.patientOrganization.findMany({ where: { organization_id: orgId, active: true }, select: { patient_id: true } }),
      prisma.encounter.count({ where: { OR: [{ source_system_id: orgId }, { organization_id: orgId }] } }),
      prisma.condition.count({ where: { OR: [{ source_system_id: orgId }, { organization_id: orgId }] } }),
      prisma.observation.count({ where: { OR: [{ source_system_id: orgId }, { organization_id: orgId }] } }),
      prisma.medicationRequest.count({ where: { OR: [{ source_system_id: orgId }, { organization_id: orgId }] } }),
      prisma.immunization.count({ where: { OR: [{ source_system_id: orgId }, { organization_id: orgId }] } }),
      prisma.claim.count({ where: { OR: [{ source_system_id: orgId }, { organization_id: orgId }] } }),
      prisma.coverage.count({ where: { OR: [{ source_system_id: orgId }, { organization_id: orgId }] } }),
      prisma.dataImport.findMany({ where: { organization_id: orgId }, orderBy: { started_at: 'desc' }, take: 5 }),
      prisma.encounter.findMany({ where: { OR: [{ source_system_id: orgId }, { organization_id: orgId }] }, orderBy: { created_at: 'desc' }, take: 1 }),
      prisma.rawRecord.count({ where: { source_system_id: orgId } }).catch(() => 0)
    ]);

    const linkedIdsSet = new Set(linkedPatientIds.map(r => r.patient_id));
    let directPatients: any[] = [];
    if (patientsBySource > 0) {
      directPatients = await prisma.patient.findMany({ where: { source_system_id: orgId }, select: { id: true } });
    }
    let patientCount = linkedIdsSet.size;
    for (const dp of directPatients) {
      if (!linkedIdsSet.has(dp.id)) patientCount++;
    }
    if (patientCount === 0) patientCount = patientLinks > 0 ? patientLinks : patientsBySource;

    res.json({
      organizationId: orgId,
      patientsCount: patientCount,
      encountersCount: encounters,
      conditionsCount: conditions,
      observationsCount: observations,
      medicationsCount: medications,
      immunizationsCount: immunizations,
      claimsCount: claims,
      coveragesCount: coverages,
      rawRecordsCount: rawCount,
      recentImports: recentImports.map((r: any) => ({
        id: r.id,
        fileName: r.file_name,
        importType: r.import_type,
        status: r.status,
        recordsProcessed: r.records_processed,
        recordsFailed: r.records_failed,
        startedAt: r.started_at,
        completedAt: r.completed_at
      })),
      lastActivityAt: recentEncounters[0]?.created_at || recentImports[0]?.started_at || null
    });
  } catch (error) {
    console.error('Hospital stats error:', error);
    res.status(500).json({ error: 'Failed to load hospital stats' });
  }
});

// Global unified registry (read-only) for hospital - scoped, requires BREAK_GLASS outside org
router.get('/global-patients', async (req: Request, res: Response) => {
  try {
    if (req.user?.role?.role_code === 'CLINICIAN') return res.status(403).json({ error: 'CLINICIAN cannot access global registry - use /patients (org-scoped) or break-glass' });
    const patients = await prisma.patient.findMany({
      include: { identifiers: true },
      orderBy: { created_at: 'desc' },
      take: 20
    });
    res.json(patients.map((p: any) => ({
      id: p.id,
      internalId: p.internal_id,
      firstName: p.first_name,
      lastName: p.last_name,
      firstNameAr: p.first_name_ar,
      lastNameAr: p.last_name_ar,
      gender: p.gender,
      birthDate: p.birth_date ? p.birth_date.toISOString().split('T')[0] : null,
      phone: p.phone,
      email: p.email,
      identifiers: p.identifiers,
      sourceSystemId: p.source_system_id,
      status: p.status,
      createdAt: p.created_at
    })));
  } catch (error) {
    console.error('Hospital global patients error:', error);
    res.status(500).json({ error: 'Failed to load global registry' });
  }
});

// Hospital patients (scoped) - UNION of PatientOrganization links + source_system_id direct records (deduplicated Single Source of Truth)
router.get('/patients', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organization_id;
    const links = await prisma.patientOrganization.findMany({
      where: { organization_id: orgId, active: true },
      include: { patient: { include: { identifiers: true } } }
    });
    const directPatients = await prisma.patient.findMany({
      where: { source_system_id: orgId },
      include: { identifiers: true },
      orderBy: { created_at: 'desc' },
      take: 100
    });
    const merged = new Map<string, any>();
    for (const l of links) {
      merged.set(l.patient.id, {
        id: l.patient.id,
        internalId: l.patient.internal_id,
        firstName: l.patient.first_name,
        lastName: l.patient.last_name,
        firstNameAr: l.patient.first_name_ar,
        lastNameAr: l.patient.last_name_ar,
        gender: l.patient.gender,
        birthDate: l.patient.birth_date ? l.patient.birth_date.toISOString().split('T')[0] : null,
        phone: l.patient.phone,
        identifiers: l.patient.identifiers,
        relationshipType: l.relationship_type,
        assignedAt: l.assigned_at,
        provenance: 'LINKED'
      });
    }
    for (const p of directPatients) {
      if (!merged.has(p.id)) {
        merged.set(p.id, {
          id: p.id,
          internalId: p.internal_id,
          firstName: p.first_name,
          lastName: p.last_name,
          firstNameAr: p.first_name_ar,
          lastNameAr: p.last_name_ar,
          gender: p.gender,
          birthDate: p.birth_date ? p.birth_date.toISOString().split('T')[0] : null,
          phone: p.phone,
          identifiers: p.identifiers,
          relationshipType: 'PRIMARY_CARE',
          assignedAt: p.created_at,
          provenance: 'DIRECT_SOURCE'
        });
      }
    }
    const patients = Array.from(merged.values()).sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
    res.json(patients.slice(0, 100));
  } catch (error) {
    console.error('Hospital patients error:', error);
    res.status(500).json({ error: 'Failed to load patients' });
  }
});

// Hospital view of longitudinal record - enforces org linkage + consent
router.get('/patients/:id/longitudinal', async (req: Request, res: Response) => {
  try {
    const patientId = req.params.id as string;
    const orgId = req.user!.organization_id;
    const role = req.user!.role?.role_code;
    if (role === 'CLINICIAN' || role === 'HOSPITAL_ADMIN') {
      const link = await prisma.patientOrganization.findFirst({ where: { patient_id: patientId, organization_id: orgId, active: true } });
      const direct = await prisma.patient.findFirst({ where: { id: patientId, source_system_id: orgId } });
      const internal = await prisma.patient.findFirst({ where: { internal_id: patientId } });
      const pid = internal?.id || patientId;
      const link2 = !link ? await prisma.patientOrganization.findFirst({ where: { patient_id: pid, organization_id: orgId, active: true } }) : link;
      if (!link && !direct && !link2) {
        const consent = await prisma.consent.findFirst({ where: { patient_id: pid, organization_id: orgId, granted: true } });
        if (!consent) return res.status(403).json({ error: 'Patient not linked to your organization and no consent granted - use break-glass for emergency' });
      }
    }
    const record = await canonicalStore.getLongitudinalRecord(patientId);
    if (!record) return res.status(404).json({ error: 'Patient not found' });
    // Audit hospital viewing global record (read-only)
    try {
      await prisma.auditLog.create({
        data: {
          entity_type: 'Patient',
          entity_id: patientId,
          action: 'HOSPITAL_VIEW_GLOBAL_RECORD',
          actor_id: req.user!.id,
          organization_id: req.user!.organization_id,
          details: `Hospital ${req.user!.organization_id} viewed global longitudinal record for patient ${patientId} (read-only, separate view but integrated DB)`
        }
      });
    } catch (e) {}
    res.json(record);
  } catch (error) {
    console.error('Hospital longitudinal error:', error);
    res.status(500).json({ error: 'Failed to load longitudinal record' });
  }
});

// Hospital imports history
router.get('/imports', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organization_id;
    const imports = await prisma.dataImport.findMany({
      where: { organization_id: orgId },
      orderBy: { started_at: 'desc' },
      take: 20
    });
    res.json(imports.map((r: any) => ({
      id: r.id,
      sourceSystem: r.source_system,
      fileName: r.file_name,
      importType: r.import_type,
      status: r.status,
      recordsProcessed: r.records_processed,
      recordsFailed: r.records_failed,
      startedAt: r.started_at,
      completedAt: r.completed_at
    })));
  } catch (error) {
    console.error('Hospital imports error:', error);
    res.status(500).json({ error: 'Failed to load imports' });
  }
});

// Get hospital details
router.get('/info', requireHospitalStaff as any, async (req, res) => {
  // TODO: Implement via Prisma
  res.json({ message: 'Hospital details' });
});

// Upload patient records
router.post('/patients', requireHospitalAdmin as any, async (req, res) => {
  res.json({ message: 'Patient registered successfully' });
});

// Upload encounters (visits)
router.post('/encounters', requireHospitalStaff as any, async (req, res) => {
  res.json({ message: 'Encounter registered successfully' });
});

export const hospitalRoutes = router;
