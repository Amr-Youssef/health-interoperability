import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';
async function resolvePatientInternalId(user, canonicalStore) {
    if (!user)
        return null;
    if (user.patient_profile_id) {
        const p = await canonicalStore.getPatient(user.patient_profile_id);
        if (p)
            return p.internalId;
    }
    const byNid = await canonicalStore.findPatientByIdentifier(user.username);
    if (byNid)
        return byNid.internalId;
    return user.patient_profile_id || null;
}
export function createClinicalRoutes(canonicalStore) {
    const router = Router();
    router.get('/medications', verifyToken, requirePermission('FHIR_READ_SELF', 'FHIR_READ_ORG', 'FHIR_READ_ALL'), async (req, res) => {
        const q = String(req.query.q || '').trim().toLowerCase();
        const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 5), 50);
        const skip = (page - 1) * limit;
        const user = req.user;
        let list = await canonicalStore.getAllMedicationRequests();
        if (user?.role?.role_code === 'PATIENT') {
            const targetId = await resolvePatientInternalId(user, canonicalStore);
            if (targetId)
                list = list.filter((m) => m.patientId === targetId);
            else
                list = [];
        }
        if (q)
            list = list.filter((m) => (m.medication?.code?.sourceCode || '').toLowerCase().includes(q) || (m.medication?.code?.sfdaDisplay || '').toLowerCase().includes(q));
        const total = list.length;
        list = list.slice(skip, skip + limit);
        if (req.query.q || req.query.page)
            return res.json({ items: list, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) });
        res.json(list);
    });
    router.get('/immunizations', verifyToken, requirePermission('FHIR_READ_SELF', 'FHIR_READ_ORG', 'FHIR_READ_ALL'), async (req, res) => {
        const q = String(req.query.q || '').trim().toLowerCase();
        const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 5), 50);
        const skip = (page - 1) * limit;
        const user = req.user;
        let list = await canonicalStore.getAllImmunizations();
        if (user?.role?.role_code === 'PATIENT') {
            const targetId = await resolvePatientInternalId(user, canonicalStore);
            if (targetId)
                list = list.filter((v) => v.patientId === targetId);
            else
                list = [];
        }
        if (q)
            list = list.filter((v) => (v.vaccineCode?.sourceCode || '').toLowerCase().includes(q) || (v.vaccineCode?.sourceDisplay || '').toLowerCase().includes(q));
        const total = list.length;
        list = list.slice(skip, skip + limit);
        if (req.query.q || req.query.page)
            return res.json({ items: list, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) });
        res.json(list);
    });
    return router;
}
//# sourceMappingURL=clinical.routes.js.map