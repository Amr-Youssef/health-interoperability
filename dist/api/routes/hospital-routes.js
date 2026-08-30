import { Router } from 'express';
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
// Middleware: Verify Hospital Admin Role & Organization Scope
function requireHospitalAdmin(req, res, next) {
    if (req.user?.role?.role_code !== 'HOSPITAL_ADMIN') {
        return res.status(403).json({ error: 'Access denied: Hospital Admin required' });
    }
    next();
}
router.use(verifyToken);
router.use(requireHospitalAdmin);
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
// Hospital dashboard stats (scoped to own organization)
router.get('/me/stats', async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        const [patientLinks, patientsBySource, encounters, conditions, observations, medications, immunizations, claims, coverages, recentImports, recentEncounters] = await Promise.all([
            prisma.patientOrganization.count({ where: { organization_id: orgId, active: true } }),
            prisma.patient.count({ where: { source_system_id: orgId } }),
            prisma.encounter.count({ where: { source_system_id: orgId } }),
            prisma.condition.count({ where: { source_system_id: orgId } }),
            prisma.observation.count({ where: { source_system_id: orgId } }),
            prisma.medicationRequest.count({ where: { source_system_id: orgId } }),
            prisma.immunization.count({ where: { source_system_id: orgId } }),
            prisma.claim.count({ where: { source_system_id: orgId } }),
            prisma.coverage.count({ where: { source_system_id: orgId } }),
            prisma.dataImport.findMany({ where: { organization_id: orgId }, orderBy: { started_at: 'desc' }, take: 5 }),
            prisma.encounter.findMany({ where: { source_system_id: orgId }, orderBy: { created_at: 'desc' }, take: 1 })
        ]);
        // Also count raw records for this org if source_system_id matches orgId
        let rawCount = 0;
        let patientCount = patientLinks;
        // Fallback to source_system_id count if PatientOrganization is empty (legacy uploads use source_system_id)
        if (patientCount === 0 && patientsBySource > 0)
            patientCount = patientsBySource;
        try {
            rawCount = await prisma.rawRecord.count({ where: { source_system_id: orgId } });
        }
        catch (e) {
            rawCount = 0;
        }
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
// Global unified registry (read-only) for hospital - all patients nationally, separate from hospital's own but same DB (integrated)
router.get('/global-patients', async (req, res) => {
    try {
        const patients = await prisma.patient.findMany({
            include: { identifiers: true },
            orderBy: { created_at: 'desc' },
            take: 100
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
// Hospital patients (scoped) - uses PatientOrganization link, fallback to source_system_id for legacy uploads
router.get('/patients', async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        let patients = [];
        const links = await prisma.patientOrganization.findMany({
            where: { organization_id: orgId, active: true },
            include: { patient: { include: { identifiers: true } } }
        });
        if (links.length > 0) {
            patients = links.map((l) => ({
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
                assignedAt: l.assigned_at
            }));
        }
        else {
            // Fallback: patients created via legacy migration where source_system_id == orgId
            const directPatients = await prisma.patient.findMany({
                where: { source_system_id: orgId },
                include: { identifiers: true },
                orderBy: { created_at: 'desc' },
                take: 50
            });
            patients = directPatients.map((p) => ({
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
                assignedAt: p.created_at
            }));
        }
        res.json(patients);
    }
    catch (error) {
        console.error('Hospital patients error:', error);
        res.status(500).json({ error: 'Failed to load patients' });
    }
});
// Hospital view of global longitudinal record (read-only, separate but integrated)
router.get('/patients/:id/longitudinal', async (req, res) => {
    try {
        const patientId = req.params.id;
        const record = await canonicalStore.getLongitudinalRecord(patientId);
        if (!record)
            return res.status(404).json({ error: 'Patient not found' });
        // Audit hospital viewing global record (read-only)
        try {
            await prisma.auditLog.create({
                data: {
                    entity_type: 'Patient',
                    entity_id: patientId,
                    action: 'HOSPITAL_VIEW_GLOBAL_RECORD',
                    actor_id: req.user.id,
                    organization_id: req.user.organization_id,
                    details: `Hospital ${req.user.organization_id} viewed global longitudinal record for patient ${patientId} (read-only, separate view but integrated DB)`
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
router.get('/info', requireHospitalAdmin, async (req, res) => {
    // TODO: Implement via Prisma
    res.json({ message: 'Hospital details' });
});
// Upload patient records
router.post('/patients', requireHospitalAdmin, async (req, res) => {
    res.json({ message: 'Patient registered successfully' });
});
// Upload encounters (visits)
router.post('/encounters', requireHospitalAdmin, async (req, res) => {
    res.json({ message: 'Encounter registered successfully' });
});
export const hospitalRoutes = router;
//# sourceMappingURL=hospital-routes.js.map