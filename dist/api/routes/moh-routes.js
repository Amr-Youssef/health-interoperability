import { Router } from 'express';
import { verifyToken, requireNationalAdmin } from '../../security/auth-middleware.js';
import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { PrismaCanonicalStore } from '../../persistence/prisma-canonical-store.js';
const router = Router();
const canonicalStore = new PrismaCanonicalStore(prisma);
router.use(verifyToken);
router.use(requireNationalAdmin);
router.get('/dashboard', async (req, res) => {
    try {
        const [patientsTotal, encountersTotal, conditionsTotal, observationsTotal, medicationsTotal, immunizationsTotal, claimsTotal, coveragesTotal, organizationsTotal, pendingHospitals, activeHospitals, usersTotal, rawRecordsTotal, unverifiedAllergies, unverifiedMeds, unverifiedConditions, unverifiedProcedures, unverifiedVitals, pendingProfiles] = await Promise.all([
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
            prisma.rawRecord.count().catch(() => 0),
            prisma.patientReportedAllergy.count({ where: { verification_status: 'UNVERIFIED' } }).catch(() => 0),
            prisma.patientReportedMedication.count({ where: { verification_status: 'UNVERIFIED' } }).catch(() => 0),
            prisma.patientReportedCondition.count({ where: { verification_status: 'UNVERIFIED' } }).catch(() => 0),
            prisma.patientReportedProcedure.count({ where: { verification_status: 'UNVERIFIED' } }).catch(() => 0),
            prisma.patientReportedVitalObservation.count({ where: { verification_status: 'UNVERIFIED' } }).catch(() => 0),
            prisma.patientProfile.count({ where: { verification_status: 'SELF_REPORTED' } }).catch(() => 0)
        ]);
        const pendingOrgsRaw = await prisma.organization.findMany({ where: { status: 'PENDING_APPROVAL' }, orderBy: { created_at: 'desc' }, take: 10 });
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
                profiles: pendingProfiles,
                total: unverifiedAllergies + unverifiedMeds + unverifiedConditions + unverifiedProcedures + unverifiedVitals
            },
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
            pendingHospitalsList
        });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load national dashboard', details: e.message });
    }
});
router.get('/hospitals', async (req, res) => {
    try {
        const status = req.query.status;
        const where = {};
        if (status)
            where.status = status;
        else
            where.organization_type = { not: 'MOH' };
        if (!status)
            where.organization_type = { not: 'MOH' };
        const orgs = await prisma.organization.findMany({ where, orderBy: { created_at: 'desc' }, take: 200 });
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
        res.json(enriched);
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
        const where = {};
        if (q)
            where.OR = [{ username: { contains: q, mode: 'insensitive' } }, { full_name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }];
        if (roleFilter)
            where.role = { role_code: roleFilter };
        const [total, users] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({ where, include: { role: true, organization: true }, orderBy: { created_at: 'desc' }, skip, take: limit })
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
        if (req.query.q || req.query.page || req.query.role)
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
        const updated = await prisma.user.update({ where: { id }, data: { is_active } });
        await prisma.auditLog.create({ data: { entity_type: 'User', entity_id: id, action: is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', actor_id: req.user.id, organization_id: req.user.organization_id, details: `${is_active ? 'Activated' : 'Deactivated'} user ${updated.username}` } }).catch(() => { });
        res.json({ success: true, user: { id: updated.id, username: updated.username, isActive: updated.is_active } });
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
        if (target.role_id && actorRole !== 'SYS_ADMIN') {
            const targetRole = await prisma.role.findUnique({ where: { id: target.role_id } });
            if (targetRole?.role_code === 'SYS_ADMIN' || targetRole?.role_code === 'MOH_ADMIN')
                return res.status(403).json({ error: 'لا يمكنك تعديل مستخدم بدرجة MOH_ADMIN/SYS_ADMIN' });
        }
        const role = await prisma.role.findUnique({ where: { role_code } });
        if (!role)
            return res.status(404).json({ error: 'Role not found' });
        const updated = await prisma.user.update({ where: { id }, data: { role_id: role.id } });
        await prisma.auditLog.create({ data: { entity_type: 'User', entity_id: id, action: 'USER_ROLE_CHANGED', actor_id: req.user.id, organization_id: req.user.organization_id, old_values: JSON.stringify({ old_role: (await prisma.role.findUnique({ where: { id: target.role_id } }))?.role_code }), new_values: JSON.stringify({ role_code }), details: `Changed role for ${updated.username} to ${role_code} by ${actorRole}` } }).catch(() => { });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/patients', async (req, res) => {
    try {
        const take = Math.min(parseInt(req.query.take) || 100, 200);
        const search = (req.query.search || '').trim();
        let patients = [];
        if (search) {
            patients = await prisma.patient.findMany({
                where: { OR: [{ internal_id: { contains: search } }, { first_name: { contains: search } }, { last_name: { contains: search } }, { first_name_ar: { contains: search } }, { identifiers: { some: { value: { contains: search } } } }] },
                include: { identifiers: true },
                orderBy: { created_at: 'desc' },
                take
            });
        }
        else {
            patients = await prisma.patient.findMany({ include: { identifiers: true }, orderBy: { created_at: 'desc' }, take });
        }
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
            status: p.status,
            createdAt: p.created_at
        })));
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
        const [allergies, medications, conditions, procedures, family, vitals, profiles] = await Promise.all([
            prisma.patientReportedAllergy.findMany({ where: { verification_status: 'UNVERIFIED' }, orderBy: { created_at: 'desc' }, take: 50, include: { patient: true } }).catch(() => []),
            prisma.patientReportedMedication.findMany({ where: { verification_status: 'UNVERIFIED' }, orderBy: { created_at: 'desc' }, take: 50, include: { patient: true } }).catch(() => []),
            prisma.patientReportedCondition.findMany({ where: { verification_status: 'UNVERIFIED' }, orderBy: { created_at: 'desc' }, take: 50, include: { patient: true } }).catch(() => []),
            prisma.patientReportedProcedure.findMany({ where: { verification_status: 'UNVERIFIED' }, orderBy: { created_at: 'desc' }, take: 50, include: { patient: true } }).catch(() => []),
            prisma.familyMember.findMany({ where: { verification_status: 'UNVERIFIED' }, orderBy: { created_at: 'desc' }, take: 50, include: { patient: true } }).catch(() => []),
            prisma.patientReportedVitalObservation.findMany({ where: { verification_status: 'UNVERIFIED' }, orderBy: { created_at: 'desc' }, take: 50, include: { patient: true } }).catch(() => []),
            prisma.patientProfile.findMany({ where: { verification_status: 'SELF_REPORTED' }, orderBy: { created_at: 'desc' }, take: 50, include: { patient: true } }).catch(() => [])
        ]);
        res.json({
            allergies: allergies.map((a) => ({ id: a.id, patientId: a.patient_id, patientInternalId: a.patient?.internal_id, allergenName: a.allergen_name, reactionText: a.reaction_text, severity: a.reaction_severity, createdAt: a.created_at })),
            medications: medications.map((m) => ({ id: m.id, patientId: m.patient_id, medicationName: m.medication_name, dose: m.dose, frequency: m.frequency, createdAt: m.created_at })),
            conditions: conditions.map((c) => ({ id: c.id, patientId: c.patient_id, conditionName: c.condition_name, status: c.status, createdAt: c.created_at })),
            procedures: procedures.map((p) => ({ id: p.id, patientId: p.patient_id, procedureName: p.procedure_name, procedureDate: p.procedure_date, createdAt: p.created_at })),
            family,
            vitals,
            profiles: profiles.map((p) => ({ id: p.id, patientId: p.patient_id, preferredFirstName: p.preferred_first_name, emergencyContactName: p.emergency_contact_name, createdAt: p.created_at }))
        });
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
        const take = Math.min(parseInt(req.query.take) || 50, 200);
        const logs = await prisma.auditLog.findMany({ orderBy: { created_at: 'desc' }, take });
        res.json(logs.map((l) => ({
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
        })));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/mpi/duplicates', async (req, res) => {
    try {
        const dups = await prisma.duplicateCandidate.findMany({ orderBy: { flagged_at: 'desc' }, take: 50 });
        res.json(dups);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export const mohRoutes = router;
//# sourceMappingURL=moh-routes.js.map