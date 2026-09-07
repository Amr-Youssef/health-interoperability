import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';
import { prisma } from '../../lib/prisma.js';
import { PrismaCanonicalStore } from '../../persistence/prisma-canonical-store.js';
import bcrypt from 'bcryptjs';
const router = Router();
const canonicalStore = new PrismaCanonicalStore(prisma);
const ALLOWED_HOSPITAL_FIELDS = new Set([
    'phone', 'email', 'fullName',
    'organizationName', 'organizationNameAr', 'region'
]);
const READ_ONLY_HOSPITAL_FIELDS = [
    'username', 'role', 'organizationId', 'organizationType', 'status', 'createdAt'
];
function normalizeSaudiPhoneHosp(raw) {
    const cleaned = raw.replace(/[\s\-\(\)]/g, '');
    if (/^05\d{8}$/.test(cleaned))
        return '+966' + cleaned.substring(1);
    if (/^5\d{8}$/.test(cleaned))
        return '+966' + cleaned;
    if (/^9665\d{8}$/.test(cleaned))
        return '+' + cleaned;
    if (/^\+9665\d{8}$/.test(cleaned))
        return cleaned;
    return null;
}
function isValidEmailHosp(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function validateHospitalPayload(body) {
    const keys = Object.keys(body);
    const forbidden = keys.filter(k => !ALLOWED_HOSPITAL_FIELDS.has(k));
    if (forbidden.length > 0) {
        return { valid: false, error: `حقول غير مصرح بتعديلها للمنشأة: ${forbidden.join(', ')}. المسموح فقط: بيانات التواصل والمعلومات العامة للمنشأة` };
    }
    if (keys.length === 0)
        return { valid: false, error: 'لم يتم تقديم أي حقول قابلة للتعديل' };
    const norm = {};
    if (body.fullName !== undefined) {
        const v = String(body.fullName).trim();
        if (v && (v.length < 3 || v.length > 80))
            return { valid: false, error: 'الاسم الكامل لمسؤول المنشأة يجب أن يكون بين 3 و 80 حرفاً' };
        if (v && v.split(/\s+/).length < 2)
            return { valid: false, error: 'الاسم الكامل يجب أن يحتوي على الاسم الأول واسم العائلة' };
        norm.fullName = v || null;
    }
    if (body.phone !== undefined) {
        const raw = String(body.phone).trim();
        if (raw === '')
            return { valid: false, error: 'رقم الجوال لا يمكن أن يكون فارغاً' };
        const np = normalizeSaudiPhoneHosp(raw);
        if (!np)
            return { valid: false, error: 'رقم الجوال غير صحيح: يجب أن يكون رقم سعودي يبدأ بـ 05 أو +9665' };
        norm.phone = np;
    }
    if (body.email !== undefined) {
        const raw = String(body.email).trim();
        if (raw === '')
            return { valid: false, error: 'البريد الإلكتروني لا يمكن أن يكون فارغاً للمنشأة' };
        if (!isValidEmailHosp(raw))
            return { valid: false, error: 'صيغة البريد الإلكتروني غير صحيحة' };
        norm.email = raw.toLowerCase();
    }
    if (body.organizationName !== undefined) {
        const v = String(body.organizationName).trim();
        if (!v || v.length < 3 || v.length > 120)
            return { valid: false, error: 'اسم المنشأة بالإنجليزية يجب أن يكون بين 3 و 120 حرفاً' };
        norm.organizationName = v;
    }
    if (body.organizationNameAr !== undefined) {
        const v = String(body.organizationNameAr).trim();
        if (!v || v.length < 3 || v.length > 120)
            return { valid: false, error: 'اسم المنشأة بالعربية يجب أن يكون بين 3 و 120 حرفاً' };
        if (!/[\u0600-\u06FF]/.test(v))
            return { valid: false, error: 'اسم المنشأة بالعربية يجب أن يحتوي على حروف عربية' };
        norm.organizationNameAr = v;
    }
    if (body.region !== undefined) {
        const v = String(body.region).trim();
        if (!v || v.length < 2 || v.length > 50)
            return { valid: false, error: 'المنطقة غير صالحة' };
        norm.region = v;
    }
    return { valid: true, normalized: norm };
}
async function requireHospitalStaff(req, res, next) {
    const role = req.user?.role?.role_code;
    if (role !== 'HOSPITAL_ADMIN' && role !== 'CLINICIAN') {
        return res.status(403).json({ error: 'Access denied: Hospital staff required' });
    }
    try {
        const org = await prisma.organization.findUnique({ where: { id: req.user.organization_id } });
        if (org && org.status === 'PENDING_APPROVAL')
            return res.status(403).json({ error: 'حساب المنشأة قيد المراجعة لدى وزارة الصحة - لا يمكن الوصول حتى الاعتماد', status: org.status });
        if (org && org.status === 'SUSPENDED')
            return res.status(403).json({ error: 'تم تعليق حساب المنشأة من قبل الأدمن الوطني - تواصل مع وزارة الصحة', status: org.status });
        if (org && org.status === 'REJECTED')
            return res.status(403).json({ error: 'تم رفض اعتماد المنشأة', status: org.status });
    }
    catch (e) { }
    next();
}
async function requireHospitalAdmin(req, res, next) {
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
router.get('/me', async (req, res) => {
    try {
        const user = req.user;
        const [freshUser, org] = await Promise.all([
            prisma.user.findUnique({ where: { id: user.id }, include: { role: true, organization: true } }),
            prisma.organization.findUnique({ where: { id: user.organization_id } })
        ]);
        if (!freshUser || !org)
            return res.status(404).json({ error: 'Hospital or user not found' });
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
    }
    catch (error) {
        console.error('Hospital me fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.patch('/me', async (req, res) => {
    if (req.user?.role?.role_code === 'CLINICIAN')
        return res.status(403).json({ error: 'الطبيب لا يمكنه تعديل بيانات المنشأة - فقط أدمن المنشأة' });
    try {
        const user = req.user;
        const validation = validateHospitalPayload(req.body);
        if (!validation.valid)
            return res.status(400).json({ error: validation.error });
        const data = validation.normalized;
        // Email uniqueness
        if (data.email !== undefined) {
            const dup = await prisma.user.findFirst({ where: { email: data.email, NOT: { id: user.id } } });
            if (dup)
                return res.status(400).json({ error: 'البريد الإلكتروني مسجل لمستخدم آخر' });
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
            if (dupOrg)
                return res.status(400).json({ error: 'اسم المنشأة مسجل لمنشأة أخرى' });
        }
        const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
        const freshOrg = await prisma.organization.findUnique({ where: { id: user.organization_id } });
        if (!freshUser || !freshOrg)
            return res.status(404).json({ error: 'Not found' });
        const oldValues = {};
        const newValues = {};
        const userUpdates = {};
        const orgUpdates = {};
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
        }
        catch (e) { /* best effort */ }
        res.json({
            message: 'تم تحديث بيانات المنشأة المصرح بها بنجاح وسيتم توثيقها في سجل التدقيق',
            updatedFields: Object.keys(newValues),
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                fullName: updatedUser.full_name,
                email: updatedUser.email,
                phone: updatedUser.phone
            },
            organization: {
                id: updatedOrg.id,
                organizationName: updatedOrg.organization_name,
                organizationNameAr: updatedOrg.organization_name_ar,
                organizationType: updatedOrg.organization_type,
                region: updatedOrg.region,
                status: updatedOrg.status
            }
        });
    }
    catch (error) {
        console.error('Hospital me patch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Hospital dashboard stats (scoped to own organization) - Single Source of Truth: DB counts, no client-side inference
router.get('/me/stats', async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        const orgWhere = (field) => ({ OR: [{ [field]: orgId }, { organization_id: orgId }] });
        const [patientLinks, patientsBySource, linkedPatientIds, encounters, conditions, observations, medications, immunizations, claims, coverages, recentImports, recentEncounters, rawCount] = await Promise.all([
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
        let directPatients = [];
        if (patientsBySource > 0) {
            directPatients = await prisma.patient.findMany({ where: { source_system_id: orgId }, select: { id: true } });
        }
        let patientCount = linkedIdsSet.size;
        for (const dp of directPatients) {
            if (!linkedIdsSet.has(dp.id))
                patientCount++;
        }
        if (patientCount === 0)
            patientCount = patientLinks > 0 ? patientLinks : patientsBySource;
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
            recentImports: recentImports.map((r) => ({
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
    }
    catch (error) {
        console.error('Hospital stats error:', error);
        res.status(500).json({ error: 'Failed to load hospital stats' });
    }
});
// Global unified registry (read-only) for hospital - scoped, requires BREAK_GLASS outside org
router.get('/global-patients', async (req, res) => {
    try {
        if (req.user?.role?.role_code === 'CLINICIAN')
            return res.status(403).json({ error: 'CLINICIAN cannot access global registry - use /patients (org-scoped) or break-glass' });
        const patients = await prisma.patient.findMany({
            include: { identifiers: true },
            orderBy: { created_at: 'desc' },
            take: 20
        });
        res.json(patients.map((p) => ({
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
    }
    catch (error) {
        console.error('Hospital global patients error:', error);
        res.status(500).json({ error: 'Failed to load global registry' });
    }
});
// Hospital patients (scoped) - UNION of PatientOrganization links + source_system_id direct records (deduplicated Single Source of Truth)
router.get('/patients', async (req, res) => {
    try {
        const orgId = req.user.organization_id;
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
        const merged = new Map();
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
    }
    catch (error) {
        console.error('Hospital patients error:', error);
        res.status(500).json({ error: 'Failed to load patients' });
    }
});
// Hospital view of longitudinal record - enforces org linkage + appointment/consent
router.get('/patients/:id/longitudinal', async (req, res) => {
    try {
        const patientIdParam = req.params.id;
        const orgId = req.user.organization_id;
        const role = req.user.role?.role_code;
        if (role === 'CLINICIAN' || role === 'HOSPITAL_ADMIN') {
            const patientRow = await prisma.patient.findFirst({ where: { OR: [{ id: patientIdParam }, { internal_id: patientIdParam }] } });
            const pid = patientRow?.id || patientIdParam;
            const internalId = patientRow?.internal_id || patientIdParam;
            const link = await prisma.patientOrganization.findFirst({ where: { patient_id: pid, organization_id: orgId, active: true } });
            const direct = await prisma.patient.findFirst({ where: { id: pid, source_system_id: orgId } });
            if (!link && !direct) {
                const appt = await prisma.appointment.findFirst({ where: { patient_id: internalId, organization_id: orgId, status: { in: ['booked', 'arrived', 'fulfilled'] } }, include: { consent: true } });
                const hasConsent = await prisma.consent.findFirst({ where: { patient_id: internalId, organization_id: orgId, granted: true } });
                const hasValidApptConsent = appt?.consent && appt.consent.granted && !appt.consent.revoked_at && (!appt.consent.expires_at || new Date(appt.consent.expires_at) > new Date());
                if (!hasConsent && !hasValidApptConsent) {
                    return res.status(403).json({ error: 'Patient not linked to your organization and no appointment/consent - book appointment (المواعيد والكشف) and wait for confirmation, or use break-glass for emergency' });
                }
            }
        }
        const record = await canonicalStore.getLongitudinalRecord(patientIdParam);
        if (!record)
            return res.status(404).json({ error: 'Patient not found' });
        // Audit hospital viewing global record (read-only)
        try {
            await prisma.auditLog.create({
                data: {
                    entity_type: 'Patient',
                    entity_id: patientIdParam,
                    action: 'HOSPITAL_VIEW_GLOBAL_RECORD',
                    actor_id: req.user.id,
                    organization_id: req.user.organization_id,
                    details: `Hospital ${req.user.organization_id} viewed global longitudinal record for patient ${patientIdParam} (read-only, separate view but integrated DB)`
                }
            });
        }
        catch (e) { }
        res.json(record);
    }
    catch (error) {
        console.error('Hospital longitudinal error:', error);
        res.status(500).json({ error: 'Failed to load longitudinal record' });
    }
});
// Hospital imports history
router.get('/imports', async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        const imports = await prisma.dataImport.findMany({
            where: { organization_id: orgId },
            orderBy: { started_at: 'desc' },
            take: 20
        });
        res.json(imports.map((r) => ({
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
    }
    catch (error) {
        console.error('Hospital imports error:', error);
        res.status(500).json({ error: 'Failed to load imports' });
    }
});
// Get hospital details
router.get('/info', requireHospitalStaff, async (req, res) => {
    // TODO: Implement via Prisma
    res.json({ message: 'Hospital details' });
});
// Upload patient records
router.post('/patients', requireHospitalAdmin, async (req, res) => {
    res.json({ message: 'Patient registered successfully' });
});
// Upload encounters (visits)
router.post('/encounters', requireHospitalStaff, async (req, res) => {
    res.json({ message: 'Encounter registered successfully' });
});
// Hospital user management (HOSPITAL_ADMIN only — USER_MANAGE_ORG / ROLE_ASSIGN_ORG)
router.get('/users', requireHospitalAdmin, requirePermission('USER_MANAGE_ORG'), async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        const users = await prisma.user.findMany({ where: { organization_id: orgId }, include: { role: true }, orderBy: { created_at: 'desc' } });
        res.json(users.map(u => ({ id: u.id, username: u.username, fullName: u.full_name, email: u.email, phone: u.phone, role: u.role.role_code, isActive: u.is_active, createdAt: u.created_at })));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/users', requireHospitalAdmin, requirePermission('USER_MANAGE_ORG', 'ROLE_ASSIGN_ORG'), async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        const { username, password, full_name, email, phone, role_code } = req.body;
        if (!username || !password || !full_name)
            return res.status(400).json({ error: 'username, password, full_name required' });
        if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
            return res.status(400).json({ error: 'كلمة المرور ضعيفة: 8+ حروف وأرقام' });
        const existing = await prisma.user.findFirst({ where: { OR: [{ username: username.trim() }, ...(email ? [{ email: email.trim().toLowerCase() }] : [])] } });
        if (existing)
            return res.status(400).json({ error: 'اسم المستخدم أو البريد مسجل مسبقاً' });
        const allowedRoles = ['CLINICIAN', 'HOSPITAL_ADMIN'];
        const rc = (role_code || 'CLINICIAN').toUpperCase();
        if (!allowedRoles.includes(rc))
            return res.status(400).json({ error: 'role_code must be CLINICIAN or HOSPITAL_ADMIN (org scope)' });
        const role = await prisma.role.findUnique({ where: { role_code: rc } });
        if (!role)
            return res.status(404).json({ error: 'Role not found' });
        const hash = await bcrypt.hash(password, 10);
        let phoneNorm = null;
        if (phone) {
            const c = String(phone).replace(/[\s\-\(\)]/g, '');
            if (/^05\d{8}$/.test(c))
                phoneNorm = '+966' + c.substring(1);
            else if (/^5\d{8}$/.test(c))
                phoneNorm = '+966' + c;
            else if (/^9665\d{8}$/.test(c))
                phoneNorm = '+' + c;
            else if (/^\+9665\d{8}$/.test(c))
                phoneNorm = c;
        }
        const user = await prisma.user.create({ data: { username: username.trim(), password_hash: hash, full_name: full_name.trim(), email: email ? email.trim().toLowerCase() : null, phone: phoneNorm, role_id: role.id, organization_id: orgId, is_active: true }, include: { role: true } });
        await prisma.auditLog.create({ data: { entity_type: 'User', entity_id: user.id, action: 'HOSPITAL_USER_CREATED', actor_id: req.user.id, organization_id: orgId, new_values: JSON.stringify({ username: user.username, role: rc }), details: `Hospital admin created user ${user.username} as ${rc}` } }).catch(() => { });
        res.json({ success: true, user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role.role_code } });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch('/users/:id/status', requireHospitalAdmin, requirePermission('USER_MANAGE_ORG'), async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: { role: true } });
        if (!target || target.organization_id !== orgId)
            return res.status(404).json({ error: 'User not found in your organization' });
        if (['SYS_ADMIN', 'MOH_ADMIN', 'MOH_AUDITOR'].includes(target.role.role_code))
            return res.status(403).json({ error: 'Cannot manage national roles' });
        const { is_active } = req.body;
        const updated = await prisma.user.update({ where: { id: target.id }, data: { is_active: !!is_active } });
        await prisma.auditLog.create({ data: { entity_type: 'User', entity_id: target.id, action: 'HOSPITAL_USER_STATUS_CHANGED', actor_id: req.user.id, organization_id: orgId, old_values: JSON.stringify({ is_active: target.is_active }), new_values: JSON.stringify({ is_active: !!is_active }), details: `Status changed for ${target.username}` } }).catch(() => { });
        res.json({ success: true, user: { id: updated.id, isActive: updated.is_active } });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch('/users/:id/role', requireHospitalAdmin, requirePermission('ROLE_ASSIGN_ORG'), async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: { role: true } });
        if (!target || target.organization_id !== orgId)
            return res.status(404).json({ error: 'User not found in your organization' });
        if (['SYS_ADMIN', 'MOH_ADMIN', 'MOH_AUDITOR'].includes(target.role.role_code))
            return res.status(403).json({ error: 'Cannot manage national roles' });
        const { role_code } = req.body;
        const rc = String(role_code || '').toUpperCase();
        if (!['CLINICIAN', 'HOSPITAL_ADMIN'].includes(rc))
            return res.status(400).json({ error: 'role_code must be CLINICIAN or HOSPITAL_ADMIN' });
        const role = await prisma.role.findUnique({ where: { role_code: rc } });
        if (!role)
            return res.status(404).json({ error: 'Role not found' });
        const updated = await prisma.user.update({ where: { id: target.id }, data: { role_id: role.id } });
        await prisma.auditLog.create({ data: { entity_type: 'User', entity_id: target.id, action: 'HOSPITAL_USER_ROLE_CHANGED', actor_id: req.user.id, organization_id: orgId, old_values: JSON.stringify({ role: target.role.role_code }), new_values: JSON.stringify({ role: rc }), details: `Role changed for ${target.username}` } }).catch(() => { });
        res.json({ success: true, user: { id: updated.id, role: rc } });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export const hospitalRoutes = router;
//# sourceMappingURL=hospital-routes.js.map