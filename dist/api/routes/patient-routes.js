import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { PrismaClient } from '@prisma/client';
const router = Router();
const prisma = new PrismaClient();
// Middleware: Verify Patient Role
function requirePatient(req, res, next) {
    if (req.user?.role?.role_code !== 'PATIENT') {
        return res.status(403).json({ error: 'Access denied: Patient required' });
    }
    if (!req.user?.patient_profile_id) {
        return res.status(400).json({ error: 'User is not linked to a patient profile' });
    }
    next();
}
router.use(verifyToken);
router.use(requirePatient);
// Get patient's own health record (No dummy data)
router.get('/my-record', async (req, res) => {
    try {
        const patientInternalId = req.user.patient_profile_id;
        const patientData = await prisma.patient.findUnique({
            where: { id: patientInternalId },
            include: {
                identifiers: true,
                encounters: {
                    include: {
                        observations: true,
                        conditions: true,
                        medication_requests: true,
                    }
                },
                allergies: true,
                medication_requests: true,
                consents: true
            }
        });
        if (!patientData) {
            return res.status(404).json({ error: 'Patient profile not found in the canonical database' });
        }
        res.json(patientData);
    }
    catch (error) {
        console.error('Error fetching patient record:', error);
        res.status(500).json({ error: 'Internal server error while fetching patient record' });
    }
});
// Update patient consent (Live backend update)
router.post('/consent', async (req, res) => {
    try {
        const patientInternalId = req.user.patient_profile_id;
        const { consent_type, scope, granted, organization_id } = req.body;
        if (consent_type === undefined || granted === undefined || scope === undefined) {
            return res.status(400).json({ error: 'Missing required fields: consent_type, granted, scope' });
        }
        const consent = await prisma.consent.create({
            data: {
                patient_id: patientInternalId,
                consent_type,
                scope,
                granted,
                granted_at: new Date(),
                organization_id,
                consent_source: 'PATIENT_PORTAL'
            }
        });
        res.json({ message: 'Consent updated successfully', consent });
    }
    catch (error) {
        console.error('Error updating consent:', error);
        res.status(500).json({ error: 'Internal server error while updating consent' });
    }
});
export const patientRoutes = router;
//# sourceMappingURL=patient-routes.js.map