import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';
import { prisma } from '../../lib/prisma.js';
export function createHospitalRoutes(engine) {
    const router = Router();
    router.get('/hospitals', verifyToken, async (req, res) => {
        try {
            const orgs = await prisma.organization.findMany({ where: { organization_type: { in: ['HOSPITAL', 'CLINIC', 'LABORATORY', 'PHARMACY', 'DAY_SURGERY', 'CENTER', 'MEDICAL_CENTER', 'HOSPITAL_ADMIN'] } } });
            const fallback = orgs.length === 0 ? await prisma.organization.findMany({ where: { NOT: { organization_type: 'MOH' } } }) : orgs;
            const hospitals = fallback.map(o => ({ hospitalId: o.id, hospitalName: o.organization_name, hospitalNameAr: o.organization_name_ar || o.organization_name, organizationType: o.organization_type, facilityType: o.organization_type, region: o.region || 'غير محدد', status: o.status, createdAt: o.created_at }));
            res.json(hospitals);
        }
        catch (err) {
            console.error(err);
            res.json([]);
        }
    });
    router.post('/hospitals/onboard', verifyToken, requirePermission('ORG_MANAGE_ALL'), async (req, res) => {
        try {
            const def = req.body;
            if (!def.hospitalName || !def.hospitalNameAr)
                return res.status(400).json({ error: 'Hospital names (Ar/En) are required.' });
            const region = def.region || 'Riyadh';
            const facilityType = (def.facilityType || def.organizationType || 'HOSPITAL').toUpperCase();
            const allowedTypes = ['HOSPITAL', 'CLINIC', 'DAY_SURGERY', 'LABORATORY', 'PHARMACY', 'CENTER'];
            const orgType = allowedTypes.includes(facilityType) ? facilityType : 'HOSPITAL';
            const existingByName = await prisma.organization.findFirst({ where: { OR: [{ organization_name: def.hospitalName }, { organization_name_ar: def.hospitalNameAr }] } });
            if (existingByName)
                return res.status(400).json({ error: 'اسم المنشأة مسجل مسبقاً' });
            const adminUsername = def.adminUsername?.trim();
            const adminPassword = def.adminPassword;
            const adminFullName = def.adminFullName?.trim();
            const adminEmail = def.adminEmail?.trim()?.toLowerCase();
            const adminPhoneRaw = def.adminPhone?.trim();
            if (!adminUsername || !adminPassword || !adminFullName || !adminEmail || !adminPhoneRaw)
                return res.status(400).json({ error: 'بيانات أدمن المنشأة مطلوبة: username, password, fullName, email, phone' });
            if (adminPassword.length < 8 || !/[A-Za-z]/.test(adminPassword) || !/\d/.test(adminPassword))
                return res.status(400).json({ error: 'كلمة مرور الأدمن ضعيفة: 8+ حروف وأرقام' });
            const existingUser = await prisma.user.findFirst({ where: { OR: [{ username: adminUsername }, { email: adminEmail }] } });
            if (existingUser)
                return res.status(400).json({ error: 'اسم المستخدم أو البريد للأدمن مسجل مسبقاً' });
            const phoneClean = adminPhoneRaw.replace(/[\s\-\(\)]/g, '');
            let phoneNorm = null;
            if (/^05\d{8}$/.test(phoneClean))
                phoneNorm = '+966' + phoneClean.substring(1);
            else if (/^5\d{8}$/.test(phoneClean))
                phoneNorm = '+966' + phoneClean;
            else if (/^9665\d{8}$/.test(phoneClean))
                phoneNorm = '+' + phoneClean;
            else if (/^\+9665\d{8}$/.test(phoneClean))
                phoneNorm = phoneClean;
            else
                return res.status(400).json({ error: 'رقم جوال الأدمن غير صحيح: 05xxxxxxxx أو +9665xxxxxxxx' });
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))
                return res.status(400).json({ error: 'بريد الأدمن غير صالح' });
            const hospitalAdminRole = await prisma.role.findUnique({ where: { role_code: 'HOSPITAL_ADMIN' } });
            if (!hospitalAdminRole)
                return res.status(500).json({ error: 'HOSPITAL_ADMIN role missing' });
            const org = await prisma.organization.create({ data: { organization_name: def.hospitalName, organization_name_ar: def.hospitalNameAr, organization_type: orgType, region, status: 'PENDING_APPROVAL' } });
            const { default: bcrypt } = await import('bcryptjs');
            const hash = await bcrypt.hash(adminPassword, 10);
            const adminUser = await prisma.user.create({ data: { username: adminUsername, password_hash: hash, full_name: adminFullName, email: adminEmail, phone: phoneNorm, role_id: hospitalAdminRole.id, organization_id: org.id, is_active: true } });
            await prisma.auditLog.create({ data: { entity_type: 'Organization', entity_id: org.id, action: 'HOSPITAL_ONBOARDED_PENDING', actor_id: req.user?.id, organization_id: org.id, new_values: JSON.stringify({ hospitalName: org.organization_name, hospitalNameAr: org.organization_name_ar, region, facilityType: orgType, adminUsername, sourceSchema: def.sourceSchema || null, defaultMappingConfigs: def.defaultMappingConfigs || null }), details: `SYS_ADMIN onboarded ${org.organization_name_ar} with admin ${adminUsername} -> PENDING_APPROVAL` } }).catch(() => { });
            await prisma.auditLog.create({ data: { entity_type: 'User', entity_id: adminUser.id, action: 'HOSPITAL_ADMIN_CREATED_ONBOARD', actor_id: req.user?.id, organization_id: org.id, new_values: JSON.stringify({ username: adminUsername, organizationId: org.id }), details: `Hospital admin ${adminUsername} created with facility ${org.organization_name_ar}` } }).catch(() => { });
            res.json({ success: true, message: `تم تسجيل المنشأة [${def.hospitalNameAr}] وإنشاء حساب الأدمن [${adminUsername}] - بانتظار اعتماد MOH لتفعيل الدخول`, organization: org, admin: { id: adminUser.id, username: adminUser.username, fullName: adminUser.full_name, email: adminUser.email }, hospital: { hospitalId: org.id, hospitalName: org.organization_name, hospitalNameAr: org.organization_name_ar, facilityType: orgType, region, status: org.status, createdAt: org.created_at } });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    router.post('/hospitals/:id/ingest', verifyToken, requirePermission('IMPORT_EXECUTE_ORG'), async (req, res) => {
        try {
            const targetId = req.params.id;
            const org = await prisma.organization.findUnique({ where: { id: targetId } });
            if (!org)
                return res.status(404).json({ success: false, error: 'المنشأة غير موجودة في قاعدة البيانات الحقيقية' });
            if (org.status !== 'ACTIVE')
                return res.status(403).json({ success: false, error: `المنشأة غير معتمدة - الحالة: ${org.status} - يجب اعتمادها من MOH أولاً` });
            const { entityType, sourceRecordId, payload } = req.body;
            if (!entityType || !sourceRecordId || !payload)
                return res.status(400).json({ success: false, error: 'entityType, sourceRecordId, payload مطلوبة' });
            const result = await engine.ingestDynamicPayload(targetId, entityType, sourceRecordId, payload);
            await prisma.auditLog.create({ data: { entity_type: 'DataIngest', entity_id: sourceRecordId, action: 'INGEST_CUSTOM', actor_id: req.user?.id, organization_id: targetId, new_values: JSON.stringify({ entityType, sourceRecordId }), details: `Custom ingest to ${org.organization_name_ar}` } }).catch(() => { });
            res.json({ success: true, result });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    router.post('/ingest/file', verifyToken, requirePermission('IMPORT_EXECUTE_ORG'), async (req, res) => {
        try {
            const { fileName, fileContent, sourceSystemId } = req.body;
            if (!fileName || !fileContent)
                return res.status(400).json({ error: 'Both fileName and fileContent are required.' });
            let resolvedSystemId = sourceSystemId;
            if (!resolvedSystemId || resolvedSystemId === 'file-dropzone-uploader') {
                const orgs = await prisma.organization.findMany({ where: { status: 'ACTIVE', NOT: { organization_type: 'MOH' } }, take: 1, orderBy: { created_at: 'asc' } });
                resolvedSystemId = orgs[0]?.id || sourceSystemId || 'file-dropzone-uploader';
            }
            if (resolvedSystemId && resolvedSystemId !== 'file-dropzone-uploader') {
                const org = await prisma.organization.findUnique({ where: { id: resolvedSystemId } });
                if (org && org.status !== 'ACTIVE')
                    return res.status(403).json({ success: false, error: `المنشأة المصدر غير معتمدة: ${org.status}` });
            }
            const result = await engine.ingestUploadedFile(fileName, fileContent, resolvedSystemId);
            await prisma.auditLog.create({ data: { entity_type: 'DataImport', entity_id: fileName, action: 'FILE_INGEST', actor_id: req.user?.id, organization_id: resolvedSystemId, new_values: JSON.stringify({ fileName, format: result.format }), details: `File ingest ${fileName} via ${resolvedSystemId}` } }).catch(() => { });
            res.json({ success: true, result });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    return router;
}
//# sourceMappingURL=hospital.routes.js.map