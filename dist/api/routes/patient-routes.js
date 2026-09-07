import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { prisma } from '../../lib/prisma.js';
import { ALLOWED_SELF_SERVICE_FIELDS, SOVEREIGN_READ_ONLY_FIELDS } from '../../patient/patient-identity.js';
import { getPatientSelfView, updatePatientSelfData } from '../../patient/patient.service.js';
const router = Router();
const ALLOWED_EDITABLE_FIELDS = new Set(ALLOWED_SELF_SERVICE_FIELDS);
const READ_ONLY_FIELDS_HINT = [...SOVEREIGN_READ_ONLY_FIELDS];
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
// ============================================================================
//  Personal Data - Only authorized editable fields (contact + emergency + address)
//  GET  /api/patient/me       -> returns consolidated editable + read-only data
//  PATCH /api/patient/me      -> updates ONLY whitelisted fields with validation
// ============================================================================
router.get('/me', async (req, res) => {
    try {
        const user = req.user;
        const patientId = user.patient_profile_id;
        const { patient, profile, userFresh } = await getPatientSelfView(patientId, user.id);
        const identifiers = (patient.identifiers || []).map((i) => ({ type: i.type, value: i.value, system: i.system, isActive: i.is_active }));
        const nidObj = identifiers.find((i) => i.type === 'NID' || i.type === 'IQAMA');
        res.json({
            user: { id: userFresh.id, username: userFresh.username, fullName: userFresh.full_name, email: userFresh.email, phone: userFresh.phone, role: userFresh.role.role_code, organization: userFresh.organization?.organization_name },
            patient: { id: patient.id, internalId: patient.internal_id, firstName: patient.first_name, lastName: patient.last_name, firstNameAr: patient.first_name_ar, lastNameAr: patient.last_name_ar, birthDate: patient.birth_date ? patient.birth_date.toISOString().split('T')[0] : null, gender: patient.gender, phone: patient.phone, email: patient.email, status: patient.status, identifiers, nationalId: nidObj?.value || null, nationalIdType: nidObj?.type || null },
            profile: profile ? { preferredFirstName: profile.preferred_first_name, preferredLastName: profile.preferred_last_name, preferredLanguage: profile.preferred_language, emergencyContactName: profile.emergency_contact_name, emergencyContactPhone: profile.emergency_contact_phone, emergencyContactRelationship: profile.emergency_contact_relationship, addressLine: profile.address_line, addressCity: profile.address_city, addressDistrict: profile.address_district, addressPostalCode: profile.address_postal_code, notes: profile.notes, verificationStatus: profile.verification_status, recordedAt: profile.recorded_at, updatedAt: profile.updated_at } : null,
            meta: { editableFields: Array.from(ALLOWED_EDITABLE_FIELDS), readOnlyFields: READ_ONLY_FIELDS_HINT, disclosure: 'يمكنك تعديل بيانات التواصل (جوال، بريد)، واللغة المفضلة، وجهة اتصال الطوارئ، والعنوان فقط. الهوية الوطنية، تاريخ الميلاد، الجنس، والاسم القانوني محمية وتتطلب تحقق إداري.' }
        });
    }
    catch (error) {
        console.error('Error fetching patient personal data:', error);
        res.status(500).json({ error: 'Internal server error while fetching personal data' });
    }
});
router.patch('/me', async (req, res) => {
    try {
        const user = req.user;
        const patientId = user.patient_profile_id;
        const result = await updatePatientSelfData(patientId, user.id, user.organization_id, req.body);
        res.json({
            message: 'تم تحديث بياناتك الشخصية بنجاح. الحقول المسموحة فقط تم حفظها وسيتم مراجعتها كبيانات ذاتية غير مؤكدة.',
            updatedFields: result.updatedFields,
            user: { id: result.freshUser.id, username: result.freshUser.username, fullName: result.freshUser.full_name, email: result.freshUser.email, phone: result.freshUser.phone },
            patient: { id: result.freshPatient.id, internalId: result.freshPatient.internal_id, phone: result.freshPatient.phone, email: result.freshPatient.email },
            profile: result.freshProfile ? { preferredFirstName: result.freshProfile.preferred_first_name, preferredLastName: result.freshProfile.preferred_last_name, preferredLanguage: result.freshProfile.preferred_language, emergencyContactName: result.freshProfile.emergency_contact_name, emergencyContactPhone: result.freshProfile.emergency_contact_phone, emergencyContactRelationship: result.freshProfile.emergency_contact_relationship, addressLine: result.freshProfile.address_line, addressCity: result.freshProfile.address_city, addressDistrict: result.freshProfile.address_district, addressPostalCode: result.freshProfile.address_postal_code, notes: result.freshProfile.notes } : null
        });
    }
    catch (error) {
        if (error.status)
            return res.status(error.status).json({ error: error.message });
        console.error('Error updating patient personal data:', error);
        res.status(500).json({ error: 'Internal server error while updating personal data' });
    }
});
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