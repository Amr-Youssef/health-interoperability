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
        const user = req.user;
        const list = await canonicalStore.getAllMedicationRequests();
        if (user?.role?.role_code === 'PATIENT') {
            const targetId = await resolvePatientInternalId(user, canonicalStore);
            if (targetId)
                return res.json(list.filter((m) => m.patientId === targetId));
            return res.json([]);
        }
        res.json(list);
    });
    router.get('/immunizations', verifyToken, requirePermission('FHIR_READ_SELF', 'FHIR_READ_ORG', 'FHIR_READ_ALL'), async (req, res) => {
        const user = req.user;
        const list = await canonicalStore.getAllImmunizations();
        if (user?.role?.role_code === 'PATIENT') {
            const targetId = await resolvePatientInternalId(user, canonicalStore);
            if (targetId)
                return res.json(list.filter((v) => v.patientId === targetId));
            return res.json([]);
        }
        res.json(list);
    });
    return router;
}
//# sourceMappingURL=clinical.routes.js.map