import { Router } from 'express';
import { verifyToken, requireNationalAdmin } from '../../security/auth-middleware.js';
import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { PrismaCanonicalStore } from '../../persistence/prisma-canonical-store.js';
const router = Router();
const canonicalStore = new PrismaCanonicalStore(prisma);
const parsePagination = (req, defaultLimit = 20, maxLimit = 100) => {
    const page = Math.max(Number.parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? req.query.take ?? defaultLimit), 10) || defaultLimit, 1), maxLimit);
    return { page, limit, skip: (page - 1) * limit, requested: ['page', 'limit', 'take', 'search', 'q', 'status', 'region', 'type', 'field'].some((key) => req.query[key] !== undefined) };
};
const pageEnvelope = (items, total, page, pageSize) => ({
    items, total, page, pageSize, totalPages: Math.ceil(total / pageSize)
});
router.use(verifyToken);
router.use(requireNationalAdmin);
router.get('/dashboard', async (req, res) => {
    try {
        let degradedCounts = false;
        const resilientCount = (query) => query.catch(() => {
            degradedCounts = true;
            return 0;
        });
        const [patientsTotal, encountersTotal, conditionsTotal, observationsTotal, medicationsTotal, immunizationsTotal, claimsTotal, coveragesTotal, organizationsTotal, pendingHospitals, activeHospitals, usersTotal, rawRecordsTotal, unverifiedAllergies, unverifiedMeds, unverifiedConditions, unverifiedProcedures, unverifiedVitals, unverifiedFamily, pendingProfiles] = await Promise.all([
            prisma.patient.count(),
            prisma.encounter.count(),
            prisma.condition.count(),
            prisma.observation.count(),
            prisma.medicationRequest.count(),
            prisma.immunization.count(),
            prisma.claim.count(),
            prisma.coverage.count(),
            prisma.organization.count(),
            prisma.organization.count({ where: { status: 'PENDING_APPROVAL' } }),
            prisma.organization.count({ where: { status: 'ACTIVE', organization_type: { not: 'MOH' } } }),
            prisma.user.count(),
            resilientCount(prisma.rawRecord.count()),
            resilientCount(prisma.patientReportedAllergy.count({ where: { verification_status: 'UNVERIFIED' } })),
            resilientCount(prisma.patientReportedMedication.count({ where: { verification_status: 'UNVERIFIED' } })),
            resilientCount(prisma.patientReportedCondition.count({ where: { verification_status: 'UNVERIFIED' } })),
            resilientCount(prisma.patientReportedProcedure.count({ where: { verification_status: 'UNVERIFIED' } })),
            resilientCount(prisma.patientReportedVitalObservation.count({ where: { verification_status: 'UNVERIFIED' } })),
            resilientCount(prisma.familyMember.count({ where: { verification_status: 'UNVERIFIED' } })),
            resilientCount(prisma.patientProfile.count({ where: { verification_status: 'SELF_REPORTED' } }))
        ]);
        const pendingPagination = parsePagination(req, 10, 50);
        const pendingSearch = String(req.query.search || req.query.q || '').trim();
        const pendingWhere = { status: 'PENDING_APPROVAL' };
        if (pendingSearch)
            pendingWhere.OR = [
                { organization_name: { contains: pendingSearch, mode: 'insensitive' } },
                { organization_name_ar: { contains: pendingSearch, mode: 'insensitive' } },
                { region: { contains: pendingSearch, mode: 'insensitive' } }
            ];
        const pendingOrgsRaw = await prisma.organization.findMany({
            where: pendingWhere, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            skip: pendingPagination.skip, take: pendingPagination.limit
        });
        const pendingHospitalsList = await Promise.all(pendingOrgsRaw.map(async (org) => {
            const admins = await prisma.user.findMany({ where: { organization_id: org.id }, include: { role: true }, take: 3 });
            const audit = await prisma.auditLog.findFirst({ where: { entity_type: 'Organization', entity_id: org.id, action: 'HOSPITAL_ONBOARDED_PENDING' }, orderBy: { created_at: 'desc' } });
            let hasMapping = false;
            try {
                if (audit?.new_values) {
                    const j = JSON.parse(audit.new_values);
                    hasMapping = !!(j.sourceSchema || j.defaultMappingConfigs);
                }
            }
            catch { }
            return {
                id: org.id,
                organizationName: org.organization_name,
                organizationNameAr: org.organization_name_ar,
                organizationType: org.organization_type,
                region: org.region,
                status: org.status,
                createdAt: org.created_at,
                admins: admins.map((u) => ({ id: u.id, username: u.username, fullName: u.full_name, email: u.email, phone: u.phone, role: u.role?.role_code, isActive: u.is_active })),
                hasMapping,
                onboardedBy: audit?.actor_id || null,
                onboardedAt: audit?.created_at || org.created_at
            };
        }));
        const [recentImports, recentAudit] = await Promise.all([
            prisma.dataImport.findMany({ orderBy: { started_at: 'desc' }, take: 5 }),
            prisma.auditLog.findMany({ orderBy: { created_at: 'desc' }, take: 10 })
        ]);
        res.json({
            nationalCounts: {
                patientsTotal,
                encountersTotal,
                conditionsTotal,
                observationsTotal,
                medicationsTotal,
                immunizationsTotal,
                claimsTotal,
                coveragesTotal,
                organizationsTotal,
                activeHospitals,
                pendingHospitals,
                usersTotal,
                rawRecordsTotal
            },
            verificationQueue: {
                allergies: unverifiedAllergies,
                medications: unverifiedMeds,
                conditions: unverifiedConditions,
                procedures: unverifiedProcedures,
                vitals: unverifiedVitals,
                family: unverifiedFamily,
                profiles: pendingProfiles,
                total: unverifiedAllergies + unverifiedMeds + unverifiedConditions + unverifiedProcedures + unverifiedVitals + unverifiedFamily + pendingProfiles
            },
            dataQuality: { degradedCounts },
            recentImports: recentImports.map((r) => ({
                id: r.id,
                organizationId: r.organization_id,
                fileName: r.file_name,
                importType: r.import_type,
                status: r.status,
                recordsProcessed: r.records_processed,
                recordsFailed: r.records_failed,
                startedAt: r.started_at,
                completedAt: r.completed_at
            })),
            recentAudit: recentAudit.map((a) => ({
                id: a.id,
                entityType: a.entity_type,
                entityId: a.entity_id,
                action: a.action,
                actorId: a.actor_id,
                organizationId: a.organization_id,
                details: a.details,
                createdAt: a.created_at
            })),
            pendingHospitalsList: pendingPagination.requested
                ? pageEnvelope(pendingHospitalsList, pendingHospitals, pendingPagination.page, pendingPagination.limit)
                : pendingHospitalsList
        });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load national dashboard', details: e.message });
    }
});
router.get('/hospitals', async (req, res) => {
    try {
        const status = req.query.status;
        const { page, limit, skip, requested } = parsePagination(req, 20, 100);
        const search = String(req.query.search || req.query.q || '').trim();
        const region = String(req.query.region || '').trim();
        const organizationType = String(req.query.type || '').trim();
        const where = {};
        if (status)
            where.status = status;
        else
            where.organization_type = { not: 'MOH' };
        if (organizationType)
            where.organization_type = organizationType;
        if (region)
            where.region = region;
        if (search)
            where.OR = [
                { organization_name: { contains: search, mode: 'insensitive' } },
                { organization_name_ar: { contains: search, mode: 'insensitive' } },
                { region: { contains: search, mode: 'insensitive' } }
            ];
        const [total, orgs] = await Promise.all([
            prisma.organization.count({ where }),
            prisma.organization.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip, take: limit })
        ]);
        const enriched = await Promise.all(orgs.map(async (o) => {
            const [users, patientsLinked, encounters, imports] = await Promise.all([
                prisma.user.count({ where: { organization_id: o.id } }),
                prisma.patientOrganization.count({ where: { organization_id: o.id, active: true } }),
                prisma.encounter.count({ where: { OR: [{ organization_id: o.id }, { source_system_id: o.id }] } }),
                prisma.dataImport.count({ where: { organization_id: o.id } })
            ]);
            return {
                id: o.id,
                organizationName: o.organization_name,
                organizationNameAr: o.organization_name_ar,
                organizationType: o.organization_type,
                region: o.region,
                status: o.status,
                createdAt: o.created_at,
                stats: { users, patientsLinked, encounters, imports }
            };
        }));
        res.json(requested ? pageEnvelope(enriched, total, page, limit) : enriched);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load hospitals', details: e.message });
    }
});
router.post('/hospitals/:id/approve', async (req, res) => {
    if (req.user.role?.role_code === 'MOH_AUDITOR')
        return res.status(403).json({ error: 'MOH_AUDITOR cannot approve' });
    try {
        const id = req.params.id;
        const org = await prisma.organization.findUnique({ where: { id } });
        if (!org)
            return res.status(404).json({ error: 'Organization not found' });
        if (org.status === 'ACTIVE')
            return res.json({ message: 'Already active', organization: org });
        const updated = await prisma.organization.update({ where: { id }, data: { status: 'ACTIVE' } });
        try {
            const exists = await prisma.dynamicHospital.findUnique({ where: { hospitalId: id } });
            if (!exists) {
                let storedSchema = null, storedMappings = null;
                try {
                    const audit = await prisma.auditLog.findFirst({ where: { entity_type: 'Organization', entity_id: id, action: 'HOSPITAL_ONBOARDED_PENDING' }, orderBy: { created_at: 'desc' } });
                    if (audit?.new_values) {
                        const parsed = JSON.parse(audit.new_values);
                        storedSchema = parsed.sourceSchema || null;
                        storedMappings = parsed.defaultMappingConfigs || null;
                    }
                }
                catch { }
                const facilityForDynamic = (() => {
                    const t = (updated.organization_type || 'HOSPITAL').toLowerCase();
                    if (['hospital', 'clinic', 'laboratory', 'pharmacy', 'center', 'day_surgery'].includes(t))
                        return t;
                    return 'hospital';
                })();
                const regionForDynamic = ['Riyadh', 'Makkah', 'Eastern', 'Madinah', 'Asir', 'Qassim', 'Hail', 'Tabuk', 'Najran', 'Jazan', 'AlBaha', 'AlJawf', 'NorthernBorders'].includes(updated.region || '') ? updated.region : 'Riyadh';
                const mappingConfig = storedMappings ? storedMappings[0] : {
                    id: `map-${updated.id}-pt-v1`,
                    sourceSystemId: updated.id,
                    sourceEntityType: 'client_registry',
                    targetCanonicalEntity: 'CanonicalPatient',
                    mappingVersion: '1.0.0',
                    effectiveDate: '2026-01-01',
                    status: 'ACTIVE',
                    author: 'MOH Approval Gateway',
                    description: `Maps ${updated.organization_name_ar || updated.organization_name} records to CanonicalPatient`,
                    validationState: 'VALIDATED',
                    fieldMappings: [
                        { sourceField: 'client_id', targetField: 'mrn', required: true },
                        { sourceField: 'national_id_num', targetField: 'nationalId', required: true },
                        { sourceField: 'full_arabic_name', targetField: 'givenNameAr', required: true },
                        { sourceField: 'sex_code', targetField: 'gender', required: true, transformation: 'gender_normalize' },
                        { sourceField: 'dob_gregorian', targetField: 'birthDate', required: true, transformation: 'date_normalize' }
                    ]
                };
                const sourceSchemaObj = storedSchema || {
                    sourceSystemId: updated.id,
                    tables: [{ name: 'client_registry', fields: [
                                { name: 'client_id', type: 'string', isNullable: false },
                                { name: 'national_id_num', type: 'string', isNullable: false },
                                { name: 'full_arabic_name', type: 'string', isNullable: false },
                                { name: 'dob_gregorian', type: 'string', isNullable: false },
                                { name: 'sex_code', type: 'string', isNullable: false }
                            ] }]
                };
                await prisma.dynamicHospital.create({
                    data: {
                        hospitalId: updated.id,
                        hospitalName: updated.organization_name,
                        hospitalNameAr: updated.organization_name_ar || updated.organization_name,
                        facilityType: facilityForDynamic,
                        region: regionForDynamic,
                        adapterVersion: '1.0.0',
                        sourceSchema: JSON.stringify(sourceSchemaObj),
                        defaultMappingConfigs: JSON.stringify(Array.isArray(storedMappings) ? storedMappings : [mappingConfig]),
                        createdAt: new Date().toISOString()
                    }
                });
            }
        }
        catch (dynErr) {
            console.warn('DynamicHospital create on approve failed', dynErr);
        }
        await prisma.auditLog.create({ data: { entity_type: 'Organization', entity_id: id, action: 'HOSPITAL_APPROVED', actor_id: req.user.id, organization_id: req.user.organization_id, new_values: JSON.stringify({ status: 'ACTIVE' }), details: `MOH approved hospital ${updated.organization_name_ar} (${updated.organization_name})` } }).catch(() => { });
        res.json({ success: true, message: `تم اعتماد المنشأة ${updated.organization_name_ar} بنجاح`, organization: updated });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/hospitals/:id/reject', async (req, res) => {
    if (req.user.role?.role_code === 'MOH_AUDITOR')
        return res.status(403).json({ error: 'MOH_AUDITOR cannot reject' });
    try {
        const id = req.params.id;
        const { reason } = req.body || {};
        const org = await prisma.organization.findUnique({ where: { id } });
        if (!org)
            return res.status(404).json({ error: 'Organization not found' });
        const updated = await prisma.organization.update({ where: { id }, data: { status: 'REJECTED' } });
        await prisma.auditLog.create({ data: { entity_type: 'Organization', entity_id: id, action: 'HOSPITAL_REJECTED', actor_id: req.user.id, organization_id: req.user.organization_id, details: `Rejected: ${reason || 'No reason provided'}` } }).catch(() => { });
        res.json({ success: true, organization: updated });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/hospitals/:id/suspend', async (req, res) => {
    if (req.user.role?.role_code === 'MOH_AUDITOR')
        return res.status(403).json({ error: 'MOH_AUDITOR cannot suspend' });
    try {
        const id = req.params.id;
        const org = await prisma.organization.findUnique({ where: { id } });
        if (!org)
            return res.status(404).json({ error: 'Organization not found' });
        const updated = await prisma.organization.update({ where: { id }, data: { status: 'SUSPENDED' } });
        await prisma.auditLog.create({ data: { entity_type: 'Organization', entity_id: id, action: 'HOSPITAL_SUSPENDED', actor_id: req.user.id, organization_id: req.user.organization_id, details: `Suspended by MOH admin ${req.user.username}` } }).catch(() => { });
        res.json({ success: true, organization: updated });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/users', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 5), 50);
        const skip = (page - 1) * limit;
        const roleFilter = req.query.role;
        const statusFilter = req.query.status;
        const organizationFilter = String(req.query.organization_id || '').trim();
        const where = {};
        if (q)
            where.OR = [
                { username: { contains: q, mode: 'insensitive' } },
                { full_name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } }
            ];
        if (roleFilter)
            where.role = { role_code: roleFilter };
        if (statusFilter === 'active')
            where.is_active = true;
        if (statusFilter === 'inactive')
            where.is_active = false;
        if (organizationFilter)
            where.organization_id = organizationFilter;
        const [total, users] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({ where, include: { role: true, organization: true }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip, take: limit })
        ]);
        const mapped = users.map((u) => ({
            id: u.id,
            username: u.username,
            fullName: u.full_name,
            email: u.email,
            phone: u.phone,
            role: u.role?.role_code,
            roleName: u.role?.role_name,
            organizationId: u.organization_id,
            organizationName: u.organization?.organization_name,
            organizationNameAr: u.organization?.organization_name_ar,
            isActive: u.is_active,
            patientProfileId: u.patient_profile_id,
            createdAt: u.created_at
        }));
        if (req.query.q || req.query.page || req.query.role || req.query.status || req.query.organization_id)
            return res.json({ items: mapped, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) });
        res.json(mapped);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/users/create-admin', async (req, res) => {
    if (req.user.role?.role_code === 'MOH_AUDITOR')
        return res.status(403).json({ error: 'MOH_AUDITOR cannot create users' });
    try {
        const { username, password, full_name, email, phone, role_code, organization_id } = req.body;
        const requestedRole = role_code || 'MOH_ADMIN';
        const allowedRoles = ['SYS_ADMIN', 'MOH_ADMIN', 'MOH_AUDITOR', 'HOSPITAL_ADMIN', 'CLINICIAN', 'PATIENT'];
        if (!allowedRoles.includes(requestedRole))
            return res.status(400).json({ error: 'role_code غير صالح' });
        const actorRole = req.user.role?.role_code;
        if (requestedRole === 'SYS_ADMIN' && actorRole !== 'SYS_ADMIN')
            return res.status(403).json({ error: 'Only SYS_ADMIN can create SYS_ADMIN' });
        if (requestedRole === 'MOH_ADMIN' && actorRole !== 'SYS_ADMIN')
            return res.status(403).json({ error: 'Only SYS_ADMIN can create MOH_ADMIN' });
        if (!username || !password || !full_name)
            return res.status(400).json({ error: 'username, password, full_name required' });
        if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
            return res.status(400).json({ error: 'كلمة المرور ضعيفة: 8 أحرف مع حروف وأرقام' });
        const dup = await prisma.user.findUnique({ where: { username: username.trim() } });
        if (dup)
            return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });
        if (email) {
            const dupEmail = await prisma.user.findFirst({ where: { email: email.trim().toLowerCase() } });
            if (dupEmail)
                return res.status(400).json({ error: 'البريد مسجل مسبقاً' });
        }
        const targetRole = await prisma.role.findUnique({ where: { role_code: requestedRole } });
        if (!targetRole)
            return res.status(500).json({ error: `${requestedRole} role missing` });
        let targetOrgId;
        let patientProfileId = null;
        if (['HOSPITAL_ADMIN', 'CLINICIAN'].includes(requestedRole)) {
            if (!organization_id)
                return res.status(400).json({ error: 'يجب اختيار المنشأة للـ HOSPITAL_ADMIN/CLINICIAN' });
            const org = await prisma.organization.findUnique({ where: { id: organization_id } });
            if (!org)
                return res.status(404).json({ error: 'المنشأة غير موجودة' });
            if (org.status !== 'ACTIVE')
                return res.status(403).json({ error: `المنشأة غير نشطة: ${org.status}` });
            targetOrgId = org.id;
        }
        else if (requestedRole === 'PATIENT') {
            if (organization_id) {
                const org = await prisma.organization.findUnique({ where: { id: organization_id } });
                targetOrgId = org ? org.id : (await prisma.organization.findFirst({ where: { organization_type: 'MOH' } })).id;
            }
            else {
                let mohOrg = await prisma.organization.findFirst({ where: { organization_type: 'MOH' } });
                if (!mohOrg)
                    mohOrg = await prisma.organization.create({ data: { organization_name: 'Ministry of Health', organization_name_ar: 'وزارة الصحة', organization_type: 'MOH', region: 'National', status: 'ACTIVE' } });
                targetOrgId = mohOrg.id;
            }
        }
        else {
            let mohOrg = await prisma.organization.findFirst({ where: { organization_type: 'MOH' } });
            if (!mohOrg)
                mohOrg = await prisma.organization.create({ data: { organization_name: 'Ministry of Health', organization_name_ar: 'وزارة الصحة', organization_type: 'MOH', region: 'National', status: 'ACTIVE' } });
            targetOrgId = mohOrg.id;
        }
        const hash = await bcrypt.hash(password, 10);
        let phoneNorm = null;
        if (phone) {
            const c = String(phone).replace(/[\s\-\(\)]/g, '');
            if (/^05\d{8}$/.test(c))
                phoneNorm = '+966' + c.substring(1);
            else if (/^\+9665\d{8}$/.test(c))
                phoneNorm = c;
            else if (/^9665\d{8}$/.test(c))
                phoneNorm = '+' + c;
        }
        const user = await prisma.user.create({
            data: {
                username: username.trim(),
                password_hash: hash,
                full_name: full_name.trim(),
                email: email ? email.trim().toLowerCase() : null,
                phone: phoneNorm,
                role_id: targetRole.id,
                organization_id: targetOrgId,
                patient_profile_id: patientProfileId,
                is_active: true
            },
            include: { role: true, organization: true }
        });
        await prisma.auditLog.create({ data: { entity_type: 'User', entity_id: user.id, action: `${requestedRole}_CREATED`, actor_id: req.user.id, organization_id: targetOrgId, new_values: JSON.stringify({ username: user.username, role: requestedRole }), details: `Created ${requestedRole} ${user.username} by ${req.user.username}` } }).catch(() => { });
        res.json({ success: true, user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role.role_code, organizationId: targetOrgId } });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/users/create', async (req, res) => {
    return res.redirect(307, '/api/moh/users/create-admin');
});
router.patch('/users/:id/status', async (req, res) => {
    if (req.user.role?.role_code === 'MOH_AUDITOR')
        return res.status(403).json({ error: 'MOH_AUDITOR read-only' });
    try {
        const id = req.params.id;
        const { is_active } = req.body;
        if (typeof is_active !== 'boolean')
            return res.status(400).json({ error: 'is_active boolean required' });
        if (id === req.user.id)
            return res.status(400).json({ error: 'لا يمكنك تعطيل حسابك الحالي' });
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        if (req.user.role?.role_code !== 'SYS_ADMIN') {
            const targetRole = await prisma.role.findUnique({ where: { id: user.role_id } });
            if (targetRole?.role_code === 'SYS_ADMIN' || targetRole?.role_code === 'MOH_ADMIN') {
                return res.status(403).json({ error: 'لا يمكنك تغيير حالة مستخدم بدرجة SYS_ADMIN أو MOH_ADMIN' });
            }
        }
        const updated = await prisma.user.update({ where: { id }, data: { is_active } });
        await prisma.auditLog.create({ data: { entity_type: 'User', entity_id: id, action: is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', actor_id: req.user.id, organization_id: req.user.organization_id, details: `${is_active ? 'Activated' : 'Deactivated'} user ${updated.username}` } }).catch(() => { });
        res.json({ success: true, user: { id: updated.id, username: updated.username, isActive: updated.is_active } });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch('/users/:id', async (req, res) => {
    if (req.user.role?.role_code === 'MOH_AUDITOR')
        return res.status(403).json({ error: 'MOH_AUDITOR read-only' });
    try {
        const id = req.params.id;
        const { full_name, email, phone } = req.body || {};
        if (id === req.user.id && full_name === '')
            return res.status(400).json({ error: 'الاسم الكامل مطلوب' });
        const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
        if (!target)
            return res.status(404).json({ error: 'User not found' });
        const actorRole = req.user.role?.role_code;
        if (actorRole !== 'SYS_ADMIN' && ['SYS_ADMIN', 'MOH_ADMIN'].includes(target.role.role_code)) {
            return res.status(403).json({ error: 'لا يمكنك تعديل مستخدم بدرجة SYS_ADMIN أو MOH_ADMIN' });
        }
        const data = {};
        if (full_name !== undefined) {
            const value = String(full_name).trim();
            if (value.length < 2 || value.length > 200)
                return res.status(400).json({ error: 'الاسم الكامل غير صالح' });
            data.full_name = value;
        }
        if (email !== undefined) {
            const value = email == null ? '' : String(email).trim().toLowerCase();
            if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
                return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
            const duplicate = value ? await prisma.user.findFirst({ where: { email: value, id: { not: id } } }) : null;
            if (duplicate)
                return res.status(409).json({ error: 'البريد الإلكتروني مستخدم مسبقاً' });
            data.email = value || null;
        }
        if (phone !== undefined) {
            const value = phone == null ? '' : String(phone).replace(/[\s\-\(\)]/g, '');
            if (value && !/^(05\d{8}|\+9665\d{8}|9665\d{8})$/.test(value))
                return res.status(400).json({ error: 'رقم الجوال غير صالح' });
            data.phone = value ? (value.startsWith('05') ? '+966' + value.substring(1) : value.startsWith('966') ? '+' + value : value) : null;
        }
        if (!Object.keys(data).length)
            return res.status(400).json({ error: 'لا توجد بيانات للتعديل' });
        const updated = await prisma.user.update({ where: { id }, data, include: { role: true, organization: true } });
        await prisma.auditLog.create({ data: {
                entity_type: 'User', entity_id: id, action: 'USER_PROFILE_UPDATED',
                actor_id: req.user.id, organization_id: req.user.organization_id,
                old_values: JSON.stringify({ full_name: target.full_name, email: target.email, phone: target.phone }),
                new_values: JSON.stringify(data), details: `Updated user profile ${target.username} by ${req.user.username}`
            } }).catch(() => { });
        res.json({ success: true, user: { id: updated.id, username: updated.username, fullName: updated.full_name, email: updated.email, phone: updated.phone } });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch('/users/:id/password', async (req, res) => {
    if (req.user.role?.role_code === 'MOH_AUDITOR')
        return res.status(403).json({ error: 'MOH_AUDITOR read-only' });
    try {
        const id = req.params.id;
        const { password } = req.body || {};
        if (typeof password !== 'string' || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
            return res.status(400).json({ error: 'كلمة المرور ضعيفة: 8 أحرف مع حروف وأرقام' });
        }
        const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
        if (!target)
            return res.status(404).json({ error: 'User not found' });
        if (req.user.role?.role_code !== 'SYS_ADMIN' && ['SYS_ADMIN', 'MOH_ADMIN'].includes(target.role.role_code)) {
            return res.status(403).json({ error: 'لا يمكنك إعادة ضبط كلمة مرور SYS_ADMIN أو MOH_ADMIN' });
        }
        await prisma.user.update({ where: { id }, data: { password_hash: await bcrypt.hash(password, 10) } });
        await prisma.auditLog.create({ data: { entity_type: 'User', entity_id: id, action: 'USER_PASSWORD_RESET', actor_id: req.user.id, organization_id: req.user.organization_id, details: `Reset password for ${target.username} by ${req.user.username}` } }).catch(() => { });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch('/users/:id/role', async (req, res) => {
    try {
        const id = req.params.id;
        const { role_code } = req.body;
        const actorRole = req.user.role?.role_code;
        const allowedByMoh = ['HOSPITAL_ADMIN', 'CLINICIAN', 'PATIENT', 'MOH_AUDITOR'];
        const allowedBySys = ['MOH_ADMIN', 'SYS_ADMIN', 'HOSPITAL_ADMIN', 'CLINICIAN', 'PATIENT', 'MOH_AUDITOR'];
        const allowed = actorRole === 'SYS_ADMIN' ? allowedBySys : allowedByMoh;
        if (!allowed.includes(role_code))
            return res.status(403).json({ error: actorRole === 'SYS_ADMIN' ? 'role_code غير صالح' : 'MOH_ADMIN لا يمكنه منح SYS_ADMIN/MOH_ADMIN - يتطلب SYS_ADMIN' });
        if (role_code === 'SYS_ADMIN' && actorRole !== 'SYS_ADMIN')
            return res.status(403).json({ error: 'Only SYS_ADMIN can assign SYS_ADMIN' });
        if (role_code === 'MOH_ADMIN' && actorRole !== 'SYS_ADMIN')
            return res.status(403).json({ error: 'Only SYS_ADMIN can assign MOH_ADMIN' });
        if (id === req.user.id)
            return res.status(400).json({ error: 'لا يمكنك تغيير دورك بنفسك' });
        const target = await prisma.user.findUnique({ where: { id } });
        if (!target)
            return res.status(404).json({ error: 'User not found' });
        const oldRole = await prisma.role.findUnique({ where: { id: target.role_id } });
        if (target.role_id && actorRole !== 'SYS_ADMIN') {
            if (oldRole?.role_code === 'SYS_ADMIN' || oldRole?.role_code === 'MOH_ADMIN')
                return res.status(403).json({ error: 'لا يمكنك تعديل مستخدم بدرجة MOH_ADMIN/SYS_ADMIN' });
        }
        const role = await prisma.role.findUnique({ where: { role_code } });
        if (!role)
            return res.status(404).json({ error: 'Role not found' });
        const updated = await prisma.user.update({ where: { id }, data: { role_id: role.id } });
        await prisma.auditLog.create({ data: { entity_type: 'User', entity_id: id, action: 'USER_ROLE_CHANGED', actor_id: req.user.id, organization_id: req.user.organization_id, old_values: JSON.stringify({ old_role: oldRole?.role_code }), new_values: JSON.stringify({ role_code }), details: `Changed role for ${updated.username} to ${role_code} by ${actorRole}` } }).catch(() => { });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/organization-changes', async (req, res) => {
    try {
        const { page, limit, skip, requested } = parsePagination(req, 20, 100);
        const status = String(req.query.status || 'PENDING');
        const field = String(req.query.field || '').trim();
        const search = String(req.query.search || req.query.q || '').trim();
        const where = { status };
        if (field)
            where.field = field;
        if (search)
            where.OR = [
                { field: { contains: search, mode: 'insensitive' } },
                { new_value: { contains: search, mode: 'insensitive' } },
                { old_value: { contains: search, mode: 'insensitive' } },
                { organization: { organization_name: { contains: search, mode: 'insensitive' } } },
                { organization: { organization_name_ar: { contains: search, mode: 'insensitive' } } }
            ];
        const [total, list] = await Promise.all([
            prisma.organizationChangeRequest.count({ where }),
            prisma.organizationChangeRequest.findMany({ where, include: { organization: true, requester: true }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip, take: limit })
        ]);
        const items = list.map((r) => ({ id: r.id, organizationId: r.organization_id, organizationName: r.organization?.organization_name, organizationNameAr: r.organization?.organization_name_ar, field: r.field, oldValue: r.old_value, newValue: r.new_value, status: r.status, requestedBy: r.requester?.full_name || r.requested_by, createdAt: r.created_at }));
        res.json(requested ? pageEnvelope(items, total, page, limit) : items);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/organization-changes/:id/approve', async (req, res) => {
    try {
        const r = await prisma.organizationChangeRequest.findUnique({ where: { id: req.params.id }, include: { organization: true } });
        if (!r || r.status !== 'PENDING')
            return res.status(404).json({ error: 'Request not found or not pending' });
        const fieldMap = { organizationName: 'organization_name', organizationNameAr: 'organization_name_ar', region: 'region' };
        const col = fieldMap[r.field];
        if (!col)
            return res.status(400).json({ error: 'Unknown field' });
        await prisma.organization.update({ where: { id: r.organization_id }, data: { [col]: r.new_value } });
        await prisma.organizationChangeRequest.update({ where: { id: r.id }, data: { status: 'APPROVED', reviewed_by: req.user.id, reviewed_at: new Date() } });
        await prisma.auditLog.create({ data: { entity_type: 'Organization', entity_id: r.organization_id, action: 'ORG_CHANGE_APPROVED', actor_id: req.user.id, organization_id: req.user.organization_id, new_values: JSON.stringify({ field: r.field, newValue: r.new_value }), details: `MOH approved ${r.field} change for ${r.organization?.organization_name}` } }).catch(() => { });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/organization-changes/:id/reject', async (req, res) => {
    try {
        const r = await prisma.organizationChangeRequest.findUnique({ where: { id: req.params.id } });
        if (!r || r.status !== 'PENDING')
            return res.status(404).json({ error: 'Request not found or not pending' });
        await prisma.organizationChangeRequest.update({ where: { id: r.id }, data: { status: 'REJECTED', reviewed_by: req.user.id, reviewed_at: new Date() } });
        await prisma.auditLog.create({ data: { entity_type: 'Organization', entity_id: r.organization_id, action: 'ORG_CHANGE_REJECTED', actor_id: req.user.id, organization_id: req.user.organization_id, details: `MOH rejected ${r.field} change` } }).catch(() => { });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/patients', async (req, res) => {
    try {
        const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
        const pageSize = Math.min(Math.max(parseInt(String(req.query.limit || req.query.take || '20'), 10) || 20, 5), 50);
        const search = String(req.query.search || req.query.q || '').trim();
        const status = String(req.query.status || '').trim();
        const gender = String(req.query.gender || '').trim();
        const organizationId = String(req.query.organization_id || '').trim();
        const where = {};
        if (search) {
            where.OR = [
                { internal_id: { contains: search, mode: 'insensitive' } },
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { first_name_ar: { contains: search, mode: 'insensitive' } },
                { last_name_ar: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { identifiers: { some: { value: { contains: search, mode: 'insensitive' } } } }
            ];
        }
        if (status)
            where.status = status;
        if (gender)
            where.gender = gender;
        if (organizationId)
            where.organizations = { some: { organization_id: organizationId, active: true } };
        const [total, patients] = await Promise.all([
            prisma.patient.count({ where }),
            prisma.patient.findMany({
                where,
                include: { identifiers: { where: { is_active: true }, take: 3 } },
                orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize
            })
        ]);
        res.json({
            items: patients.map((p) => ({
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
                status: p.status,
                createdAt: p.created_at
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/patients/:id/longitudinal', async (req, res) => {
    try {
        const id = req.params.id;
        const actorRole = req.user.role?.role_code;
        if (actorRole === 'MOH_AUDITOR')
            return res.status(403).json({ error: 'MOH_AUDITOR read-only: use anonymized analytics only' });
        const record = await canonicalStore.getLongitudinalRecord(id);
        if (!record)
            return res.status(404).json({ error: 'Patient not found' });
        await prisma.auditLog.create({ data: { entity_type: 'Patient', entity_id: id, action: 'MOH_VIEW_LONGITUDINAL', actor_id: req.user.id, organization_id: req.user.organization_id, details: `MOH ${actorRole} viewed longitudinal for ${id}` } }).catch(() => { });
        res.json(record);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/verification-queue', async (req, res) => {
    try {
        const { page, limit, skip, requested } = parsePagination(req, 20, 100);
        const search = String(req.query.search || req.query.q || '').trim();
        const type = String(req.query.type || '').toLowerCase();
        const patientFilter = search ? { patient: { internal_id: { contains: search, mode: 'insensitive' } } } : {};
        const query = (model, verification_status) => model.findMany({
            where: { verification_status, ...patientFilter },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip: requested && type ? skip : 0,
            take: requested && type ? limit : 50, include: { patient: true }
        });
        const [allergies, medications, conditions, procedures, family, vitals, profiles] = await Promise.all([
            query(prisma.patientReportedAllergy, 'UNVERIFIED'),
            query(prisma.patientReportedMedication, 'UNVERIFIED'),
            query(prisma.patientReportedCondition, 'UNVERIFIED'),
            query(prisma.patientReportedProcedure, 'UNVERIFIED'),
            query(prisma.familyMember, 'UNVERIFIED'),
            query(prisma.patientReportedVitalObservation, 'UNVERIFIED'),
            query(prisma.patientProfile, 'SELF_REPORTED')
        ]);
        const output = {
            allergies: allergies.map((a) => ({ id: a.id, patientId: a.patient_id, patientInternalId: a.patient?.internal_id, allergenName: a.allergen_name, reactionText: a.reaction_text, severity: a.reaction_severity, createdAt: a.created_at })),
            medications: medications.map((m) => ({ id: m.id, patientId: m.patient_id, medicationName: m.medication_name, dose: m.dose, frequency: m.frequency, createdAt: m.created_at })),
            conditions: conditions.map((c) => ({ id: c.id, patientId: c.patient_id, conditionName: c.condition_name, status: c.status, createdAt: c.created_at })),
            procedures: procedures.map((p) => ({ id: p.id, patientId: p.patient_id, procedureName: p.procedure_name, procedureDate: p.procedure_date, createdAt: p.created_at })),
            family: family.map((f) => ({ id: f.id, patientId: f.patient_id, patientInternalId: f.patient?.internal_id, relationship: f.relationship, conditionName: f.condition_name, createdAt: f.created_at })),
            vitals: vitals.map((v) => ({ id: v.id, patientId: v.patient_id, patientInternalId: v.patient?.internal_id, observationName: v.observation_display || v.observation_type, code: v.observation_code, value: v.value_quantity ?? v.value_text, unit: v.value_unit, createdAt: v.created_at })),
            profiles: profiles.map((p) => ({ id: p.id, patientId: p.patient_id, preferredFirstName: p.preferred_first_name, emergencyContactName: p.emergency_contact_name, createdAt: p.created_at }))
        };
        if (requested && type) {
            const keyMap = { allergy: 'allergies', allergies: 'allergies', medication: 'medications', medications: 'medications', condition: 'conditions', conditions: 'conditions', procedure: 'procedures', procedures: 'procedures', family: 'family', vital: 'vitals', vitals: 'vitals', profile: 'profiles', profiles: 'profiles' };
            const key = keyMap[type];
            if (!(key in output))
                return res.status(400).json({ error: 'Unknown verification type' });
            const modelMap = { allergies: prisma.patientReportedAllergy, medications: prisma.patientReportedMedication, conditions: prisma.patientReportedCondition, procedures: prisma.patientReportedProcedure, family: prisma.familyMember, vitals: prisma.patientReportedVitalObservation, profiles: prisma.patientProfile };
            const statusMap = { profiles: 'SELF_REPORTED' };
            const total = await modelMap[key].count({ where: { verification_status: statusMap[key] || 'UNVERIFIED', ...patientFilter } });
            return res.json(pageEnvelope(output[key], total, page, limit));
        }
        res.json(output);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/verification/:type/:id/verify', async (req, res) => {
    if (req.user.role?.role_code === 'MOH_AUDITOR')
        return res.status(403).json({ error: 'MOH_AUDITOR read-only' });
    try {
        const type = req.params.type;
        const id = req.params.id;
        const { decision, notes } = req.body; // VERIFIED | REFUTED
        if (!['VERIFIED', 'REFUTED'].includes(decision))
            return res.status(400).json({ error: 'decision must be VERIFIED or REFUTED' });
        const map = {
            allergy: 'patientReportedAllergy',
            medication: 'patientReportedMedication',
            condition: 'patientReportedCondition',
            procedure: 'patientReportedProcedure',
            vitals: 'patientReportedVitalObservation',
            vital: 'patientReportedVitalObservation',
            family: 'familyMember',
            profile: 'patientProfile'
        };
        const model = map[type];
        if (!model)
            return res.status(400).json({ error: 'Unknown verification type' });
        const existing = await prisma[model].findUnique({ where: { id }, select: { id: true } });
        if (!existing)
            return res.status(404).json({ error: 'Verification item not found' });
        const updated = await prisma[model].update({ where: { id }, data: { verification_status: decision } });
        await prisma.auditLog.create({ data: { entity_type: model, entity_id: id, action: `VERIFICATION_${decision}`, actor_id: req.user.id, organization_id: req.user.organization_id, details: `Verified ${type} ${id} as ${decision}: ${notes || ''}` } }).catch(() => { });
        res.json({ success: true, updated });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch('/patients/:id/identity', async (req, res) => {
    if (req.user.role?.role_code === 'MOH_AUDITOR')
        return res.status(403).json({ error: 'MOH_AUDITOR cannot modify identity' });
    try {
        const id = req.params.id;
        const { first_name, last_name, first_name_ar, last_name_ar, birth_date, gender, phone } = req.body;
        const patient = await prisma.patient.findUnique({ where: { id } });
        if (!patient)
            return res.status(404).json({ error: 'Patient not found' });
        const oldValues = { first_name: patient.first_name, last_name: patient.last_name, first_name_ar: patient.first_name_ar, last_name_ar: patient.last_name_ar, birth_date: patient.birth_date, gender: patient.gender };
        const data = {};
        if (first_name !== undefined)
            data.first_name = first_name ? String(first_name).trim() : null;
        if (last_name !== undefined)
            data.last_name = last_name ? String(last_name).trim() : null;
        if (first_name_ar !== undefined)
            data.first_name_ar = first_name_ar ? String(first_name_ar).trim() : null;
        if (last_name_ar !== undefined)
            data.last_name_ar = last_name_ar ? String(last_name_ar).trim() : null;
        if (birth_date !== undefined) {
            const d = new Date(birth_date);
            if (isNaN(d.getTime()))
                return res.status(400).json({ error: 'Invalid birth_date' });
            data.birth_date = d;
        }
        if (gender !== undefined) {
            const g = String(gender).toLowerCase();
            if (!['male', 'female'].includes(g))
                return res.status(400).json({ error: 'gender must be male/female' });
            data.gender = g;
        }
        if (phone !== undefined)
            data.phone = phone ? String(phone).trim() : null;
        if (Object.keys(data).length === 0)
            return res.status(400).json({ error: 'No fields to update' });
        const updated = await prisma.patient.update({ where: { id }, data });
        await prisma.auditLog.create({ data: { entity_type: 'Patient', entity_id: id, action: 'MOH_IDENTITY_VERIFIED_UPDATE', actor_id: req.user.id, organization_id: req.user.organization_id, old_values: JSON.stringify(oldValues), new_values: JSON.stringify(data), details: `MOH verified identity update for ${patient.internal_id}` } }).catch(() => { });
        res.json({ success: true, patient: updated });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/audit', async (req, res) => {
    try {
        const { page, limit, skip, requested } = parsePagination(req, 50, 200);
        const action = String(req.query.action || '').trim();
        const entityType = String(req.query.entity_type || '').trim();
        const actorId = String(req.query.actor_id || '').trim();
        const where = {};
        if (action)
            where.action = { contains: action, mode: 'insensitive' };
        if (entityType)
            where.entity_type = entityType;
        if (actorId)
            where.actor_id = actorId;
        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip, take: limit })
        ]);
        const items = logs.map((l) => ({
            id: l.id,
            entityType: l.entity_type,
            entityId: l.entity_id,
            action: l.action,
            actorId: l.actor_id,
            organizationId: l.organization_id,
            oldValues: l.old_values,
            newValues: l.new_values,
            details: l.details,
            createdAt: l.created_at
        }));
        res.json(requested ? pageEnvelope(items, total, page, limit) : items);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/mpi/duplicates', async (req, res) => {
    try {
        const { page, limit, skip, requested } = parsePagination(req, 20, 100);
        const status = String(req.query.status || '').trim();
        const where = status ? { status } : {};
        const [total, dups] = await Promise.all([
            prisma.duplicateCandidate.count({ where }),
            prisma.duplicateCandidate.findMany({ where, orderBy: [{ flagged_at: 'desc' }, { id: 'desc' }], skip, take: requested ? limit : 50 })
        ]);
        res.json(requested ? pageEnvelope(dups, total, page, limit) : dups);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export const mohRoutes = router;
//# sourceMappingURL=moh-routes.js.map