import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { prisma } from '../../lib/prisma.js';
const router = Router();
router.use(verifyToken);
function consentTypeForAppointment(t) {
    if (t === 'EMERGENCY')
        return 'EMERGENCY_OVERRIDE';
    if (t === 'REFERRAL')
        return 'CLUSTER_ONLY';
    if (t === 'CHRONIC')
        return 'OPT_IN_FULL';
    return 'EXPLICIT_PER_ENCOUNTER';
}
function expiresForType(t) {
    if (t === 'CHRONIC')
        return null;
    if (t === 'EMERGENCY')
        return new Date(Date.now() + 24 * 60 * 60 * 1000);
    return new Date(Date.now() + 48 * 60 * 60 * 1000);
}
router.post('/', async (req, res) => {
    try {
        const user = req.user;
        const { organization_id, appointment_type, scheduled_start, scheduled_end, reason, service_category, clinician_id, scope, allowed_organizations, blocked_categories } = req.body;
        const type = (appointment_type || 'ROUTINE').toUpperCase();
        if (!['ROUTINE', 'EMERGENCY', 'REFERRAL', 'CHRONIC'].includes(type))
            return res.status(400).json({ error: 'appointment_type must be ROUTINE/EMERGENCY/REFERRAL/CHRONIC' });
        if (!organization_id)
            return res.status(400).json({ error: 'organization_id required' });
        const org = await prisma.organization.findUnique({ where: { id: organization_id } });
        if (!org)
            return res.status(404).json({ error: 'Organization not found' });
        if (org.status !== 'ACTIVE')
            return res.status(403).json({ error: `Organization not active: ${org.status}` });
        if (!scheduled_start)
            return res.status(400).json({ error: 'scheduled_start required' });
        const start = new Date(scheduled_start);
        if (isNaN(start.getTime()))
            return res.status(400).json({ error: 'Invalid scheduled_start' });
        if (type !== 'EMERGENCY' && start <= new Date())
            return res.status(400).json({ error: 'لا يمكن حجز موعد في الماضي' });
        if (type !== 'EMERGENCY') {
            const dow = new Date(start.toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })).getDay();
            const riyadhDay = new Date(start).toLocaleString('en-US', { timeZone: 'Asia/Riyadh', weekday: 'short' });
            const isFriday = riyadhDay.includes('Fri');
            const isSaturday = riyadhDay.includes('Sat');
            if (isFriday || isSaturday)
                return res.status(400).json({ error: 'الجمعة والسبت عطلة - اختر الأحد إلى الخميس' });
            const hour = Number(new Date(start).toLocaleString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', hour12: false }));
            if (hour < 8 || hour >= 17)
                return res.status(400).json({ error: 'وقت الموعد خارج ساعات العمل (08:00-17:00 Asia/Riyadh)' });
        }
        const end = scheduled_end ? new Date(scheduled_end) : null;
        const isPatient = user.role?.role_code === 'PATIENT';
        const isClinician = user.role?.role_code === 'CLINICIAN' || user.role?.role_code === 'HOSPITAL_ADMIN';
        let patientId;
        if (isPatient) {
            if (!user.patient_profile_id)
                return res.status(400).json({ error: 'Patient profile missing' });
            const pat = await prisma.patient.findUnique({ where: { id: user.patient_profile_id } });
            if (!pat)
                return res.status(404).json({ error: 'Patient not found' });
            patientId = pat.internal_id;
        }
        else if (isClinician) {
            if (!req.body.patient_id)
                return res.status(400).json({ error: 'patient_id required for clinician booking' });
            patientId = req.body.patient_id;
            const pat = await prisma.patient.findFirst({ where: { OR: [{ id: patientId }, { internal_id: patientId }] } });
            if (!pat)
                return res.status(404).json({ error: 'Patient not found' });
            patientId = pat.internal_id;
        }
        else {
            if (!req.body.patient_id)
                return res.status(400).json({ error: 'patient_id required' });
            patientId = req.body.patient_id;
        }
        if (clinician_id) {
            const clin = await prisma.user.findUnique({ where: { id: clinician_id }, include: { role: true } });
            if (!clin)
                return res.status(404).json({ error: 'الطبيب المفضل غير موجود' });
            if (clin.role?.role_code !== 'CLINICIAN')
                return res.status(400).json({ error: 'المستخدم المحدد ليس طبيب (CLINICIAN)' });
            if (clin.organization_id !== org.id)
                return res.status(403).json({ error: 'الطبيب لا يتبع نفس المنشأة - الرغبة مرفوضة' });
            if (!clin.is_active)
                return res.status(403).json({ error: 'حساب الطبيب غير نشط' });
        }
        const appt = await prisma.appointment.create({
            data: {
                patient_id: patientId,
                organization_id: org.id,
                clinician_id: clinician_id || null,
                appointment_type: type,
                status: type === 'EMERGENCY' ? 'arrived' : 'proposed',
                service_category: service_category || 'general',
                scheduled_start: start,
                scheduled_end: end,
                reason: reason || null,
                created_by: user.id
            }
        });
        const consentType = consentTypeForAppointment(type);
        const expires = expiresForType(type);
        const granted = type === 'EMERGENCY';
        const consent = await prisma.consent.create({
            data: {
                patient_id: patientId,
                organization_id: org.id,
                appointment_id: appt.id,
                consent_type: consentType,
                granted,
                scope: scope || 'clinical_records',
                allowed_organizations: allowed_organizations ? JSON.stringify(allowed_organizations) : JSON.stringify([org.id]),
                blocked_categories: blocked_categories ? JSON.stringify(blocked_categories) : null,
                consent_source: isPatient ? 'sehhaty_portal' : 'hospital_kiosk',
                created_by: user.id,
                expires_at: expires
            }
        });
        await prisma.auditLog.create({ data: { entity_type: 'Appointment', entity_id: appt.id, action: 'APPOINTMENT_CREATED', actor_id: user.id, organization_id: org.id, new_values: JSON.stringify({ type, status: appt.status, patientId, organizationId: org.id }), details: `${type} appointment for patient ${patientId} at ${org.organization_name_ar}` } }).catch(() => { });
        if (type === 'EMERGENCY') {
            await prisma.auditLog.create({ data: { entity_type: 'Patient', entity_id: patientId, action: 'BREAK_GLASS', actor_id: user.id, organization_id: org.id, details: `Emergency appointment ${appt.id} granted immediate access` } }).catch(() => { });
            try {
                const patientRow = await prisma.patient.findFirst({ where: { internal_id: patientId } });
                if (patientRow) {
                    const existingLink = await prisma.patientOrganization.findFirst({ where: { patient_id: patientRow.id, organization_id: org.id } });
                    if (!existingLink)
                        await prisma.patientOrganization.create({ data: { patient_id: patientRow.id, organization_id: org.id, relationship_type: 'emergency', active: true } });
                    else if (!existingLink.active)
                        await prisma.patientOrganization.update({ where: { id: existingLink.id }, data: { active: true } });
                }
            }
            catch { }
        }
        res.json({ success: true, appointment: appt, consent });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/my', async (req, res) => {
    try {
        const user = req.user;
        let patientId = null;
        if (user.role?.role_code === 'PATIENT' && user.patient_profile_id) {
            const pat = await prisma.patient.findUnique({ where: { id: user.patient_profile_id } });
            patientId = pat?.internal_id || null;
        }
        else if (user.role?.role_code === 'PATIENT') {
            patientId = user.patient_profile_id;
        }
        if (!patientId && user.role?.role_code === 'PATIENT')
            return res.json([]);
        const where = user.role?.role_code === 'PATIENT' ? { patient_id: patientId } : { organization_id: user.organization_id };
        if (req.query.status)
            where.status = req.query.status;
        const list = await prisma.appointment.findMany({ where, include: { organization: true, consent: true, clinician: true, patient: false }, orderBy: { scheduled_start: 'desc' }, take: 100 });
        res.json(list);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/organization', async (req, res) => {
    try {
        const user = req.user;
        if (!['HOSPITAL_ADMIN', 'CLINICIAN', 'MOH_ADMIN', 'SYS_ADMIN'].includes(user.role?.role_code))
            return res.status(403).json({ error: 'Hospital staff only' });
        const orgId = req.query.organization_id || user.organization_id;
        if (user.role?.role_code === 'CLINICIAN' || user.role?.role_code === 'HOSPITAL_ADMIN') {
            if (orgId !== user.organization_id)
                return res.status(403).json({ error: 'Cross-org denied' });
        }
        const where = { organization_id: orgId };
        if (req.query.status)
            where.status = req.query.status;
        if (req.query.patient_id)
            where.patient_id = req.query.patient_id;
        const list = await prisma.appointment.findMany({ where, include: { organization: true, consent: true, clinician: { select: { id: true, full_name: true, username: true } } }, orderBy: { scheduled_start: 'desc' }, take: 100 });
        res.json(list);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch('/:id/status', async (req, res) => {
    try {
        const user = req.user;
        const id = req.params.id;
        const { status, clinician_id } = req.body;
        if (!['proposed', 'booked', 'arrived', 'fulfilled', 'cancelled', 'no_show'].includes(status))
            return res.status(400).json({ error: 'Invalid status' });
        if (clinician_id) {
            const clin = await prisma.user.findUnique({ where: { id: clinician_id }, include: { role: true } });
            if (!clin || clin.role?.role_code !== 'CLINICIAN')
                return res.status(400).json({ error: 'clinician_id must be CLINICIAN' });
        }
        const appt = await prisma.appointment.findUnique({ where: { id }, include: { consent: true } });
        if (!appt)
            return res.status(404).json({ error: 'Appointment not found' });
        if (user.role?.role_code === 'CLINICIAN' || user.role?.role_code === 'HOSPITAL_ADMIN') {
            if (appt.organization_id !== user.organization_id)
                return res.status(403).json({ error: 'Cross-org denied' });
            if (status === 'booked' && !appt.clinician_id && !clinician_id) {
                return res.status(400).json({ error: 'يجب تخصيص الطبيب المسؤول عند التأكيد - المستشفى تختار المتاح (الدمج: رغبة المريض اختيارية والتخصيص النهائي للمنشأة)' });
            }
        }
        else if (user.role?.role_code === 'PATIENT') {
            const pat = user.patient_profile_id ? await prisma.patient.findUnique({ where: { id: user.patient_profile_id } }) : null;
            const pid = pat?.internal_id || user.patient_profile_id;
            if (appt.patient_id !== pid)
                return res.status(403).json({ error: 'Not your appointment' });
            if (!['cancelled'].includes(status))
                return res.status(403).json({ error: 'Patient can only cancel' });
        }
        const targetClinicianId = clinician_id || appt.clinician_id;
        if (targetClinicianId) {
            const targetClin = await prisma.user.findUnique({ where: { id: targetClinicianId }, include: { role: true } });
            if (!targetClin || targetClin.organization_id !== appt.organization_id)
                return res.status(403).json({ error: 'الطبيب لا يتبع نفس المنشأة' });
        }
        const updated = await prisma.appointment.update({ where: { id }, data: { status, clinician_id: targetClinicianId } });
        if (status === 'booked' && appt.consent) {
            await prisma.consent.update({ where: { id: appt.consent.id }, data: { granted: true, granted_at: new Date() } });
            try {
                const patientRow = await prisma.patient.findFirst({ where: { internal_id: appt.patient_id } });
                if (patientRow) {
                    const existingLink = await prisma.patientOrganization.findFirst({ where: { patient_id: patientRow.id, organization_id: appt.organization_id } });
                    if (!existingLink)
                        await prisma.patientOrganization.create({ data: { patient_id: patientRow.id, organization_id: appt.organization_id, relationship_type: appt.appointment_type === 'REFERRAL' ? 'referred' : appt.appointment_type === 'EMERGENCY' ? 'emergency' : 'registered', active: true } });
                    else if (!existingLink.active)
                        await prisma.patientOrganization.update({ where: { id: existingLink.id }, data: { active: true } });
                }
            }
            catch { }
        }
        if (status === 'fulfilled' && appt.consent) {
            await prisma.consent.update({ where: { id: appt.consent.id }, data: { expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
        }
        await prisma.auditLog.create({ data: { entity_type: 'Appointment', entity_id: id, action: `APPOINTMENT_${status.toUpperCase()}`, actor_id: user.id, organization_id: appt.organization_id, new_values: JSON.stringify({ status }), details: `Appointment ${id} -> ${status} by ${user.username}` } }).catch(() => { });
        res.json({ success: true, appointment: updated });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const appt = await prisma.appointment.findUnique({ where: { id: req.params.id }, include: { organization: true, consent: true, clinician: true } });
        if (!appt)
            return res.status(404).json({ error: 'Not found' });
        const user = req.user;
        if (user.role?.role_code === 'PATIENT') {
            const pat = user.patient_profile_id ? await prisma.patient.findUnique({ where: { id: user.patient_profile_id } }) : null;
            const pid = pat?.internal_id || user.patient_profile_id;
            if (appt.patient_id !== pid)
                return res.status(403).json({ error: 'Forbidden' });
        }
        else if (['CLINICIAN', 'HOSPITAL_ADMIN'].includes(user.role?.role_code)) {
            if (appt.organization_id !== user.organization_id)
                return res.status(403).json({ error: 'Cross-org denied' });
        }
        res.json(appt);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export const appointmentsRoutes = router;
//# sourceMappingURL=appointments-routes.js.map