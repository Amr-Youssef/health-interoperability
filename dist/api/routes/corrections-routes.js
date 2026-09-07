import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { prisma } from '../../lib/prisma.js';
const router = Router();
router.use(verifyToken);
const allowedTypes = ['encounter', 'condition', 'observation', 'medication'];
const allowedStatuses = ['CORRECTION_REQUEST', 'CORRECTED', 'REDACTED', 'ENTERED_IN_ERROR'];
router.post('/:type/:id/request', async (req, res) => {
    try {
        const user = req.user;
        const role = user.role?.role_code;
        if (!['CLINICIAN', 'HOSPITAL_ADMIN'].includes(role))
            return res.status(403).json({ error: 'Only CLINICIAN/HOSPITAL_ADMIN can request correction' });
        const type = req.params.type;
        const id = req.params.id;
        const { reason } = req.body;
        if (!allowedTypes.includes(type))
            return res.status(400).json({ error: 'Invalid type' });
        if (!reason || String(reason).trim().length < 5)
            return res.status(400).json({ error: 'correction reason required (5+ chars)' });
        const modelMap = { encounter: prisma.encounter, condition: prisma.condition, observation: prisma.observation, medication: prisma.medicationRequest };
        const model = modelMap[type];
        const record = await model.findUnique({ where: { id } });
        if (!record)
            return res.status(404).json({ error: 'Record not found' });
        if (record.organization_id && record.organization_id !== user.organization_id && role !== 'HOSPITAL_ADMIN') {
            return res.status(403).json({ error: 'Cross-org denied' });
        }
        const updated = await model.update({ where: { id }, data: { correction_status: 'CORRECTION_REQUEST', correction_reason: String(reason).trim(), corrected_by: user.id, corrected_at: new Date() } });
        await prisma.auditLog.create({ data: { entity_type: type, entity_id: id, action: 'CORRECTION_REQUEST', actor_id: user.id, organization_id: user.organization_id, old_values: JSON.stringify({ correction_status: record.correction_status }), new_values: JSON.stringify({ correction_status: 'CORRECTION_REQUEST', reason }), details: `${role} requested correction for ${type} ${id}: ${reason}` } }).catch(() => { });
        res.json({ success: true, record: updated });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/:type/:id/approve', async (req, res) => {
    try {
        const user = req.user;
        const role = user.role?.role_code;
        if (!['HOSPITAL_ADMIN', 'MOH_ADMIN', 'SYS_ADMIN'].includes(role))
            return res.status(403).json({ error: 'Only HOSPITAL_ADMIN/MOH can approve' });
        const type = req.params.type;
        const id = req.params.id;
        const { decision, reason } = req.body;
        if (!['CORRECTED', 'REDACTED', 'ENTERED_IN_ERROR', 'REJECTED'].includes(decision))
            return res.status(400).json({ error: 'decision must be CORRECTED/REDACTED/ENTERED_IN_ERROR/REJECTED' });
        const modelMap = { encounter: prisma.encounter, condition: prisma.condition, observation: prisma.observation, medication: prisma.medicationRequest };
        const model = modelMap[type];
        if (!model)
            return res.status(400).json({ error: 'Invalid type' });
        const record = await model.findUnique({ where: { id } });
        if (!record)
            return res.status(404).json({ error: 'Not found' });
        if (record.correction_status !== 'CORRECTION_REQUEST')
            return res.status(400).json({ error: 'No pending correction request' });
        const newStatus = decision === 'REJECTED' ? 'ACTIVE' : decision;
        const updated = await model.update({ where: { id }, data: { correction_status: newStatus, correction_reason: reason || record.correction_reason, corrected_by: user.id, corrected_at: new Date() } });
        await prisma.auditLog.create({ data: { entity_type: type, entity_id: id, action: `CORRECTION_${decision}`, actor_id: user.id, organization_id: user.organization_id, old_values: JSON.stringify({ correction_status: record.correction_status }), new_values: JSON.stringify({ correction_status: newStatus }), details: `${role} ${decision} correction for ${type} ${id}` } }).catch(() => { });
        res.json({ success: true, record: updated });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/pending', async (req, res) => {
    try {
        const user = req.user;
        const role = user.role?.role_code;
        if (!['HOSPITAL_ADMIN', 'MOH_ADMIN', 'SYS_ADMIN', 'MOH_AUDITOR'].includes(role))
            return res.status(403).json({ error: 'Not authorized' });
        const where = { correction_status: 'CORRECTION_REQUEST' };
        if (['HOSPITAL_ADMIN', 'CLINICIAN'].includes(role)) {
            where.organization_id = user.organization_id;
        }
        const [encs, conds, obs, meds] = await Promise.all([
            prisma.encounter.findMany({ where, take: 20, orderBy: { corrected_at: 'desc' } }),
            prisma.condition.findMany({ where, take: 20, orderBy: { corrected_at: 'desc' } }),
            prisma.observation.findMany({ where, take: 20, orderBy: { corrected_at: 'desc' } }),
            prisma.medicationRequest.findMany({ where, take: 20, orderBy: { corrected_at: 'desc' } }),
        ]);
        res.json({ encounters: encs, conditions: conds, observations: obs, medications: meds });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export const correctionsRoutes = router;
//# sourceMappingURL=corrections-routes.js.map