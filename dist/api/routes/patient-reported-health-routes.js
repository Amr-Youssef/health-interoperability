import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { prisma } from '../../lib/prisma.js';
import { PatientReportedHealthService } from '../../core/patient-reported-health-service.js';
const router = Router();
const healthService = new PatientReportedHealthService(prisma);
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
// Middleware: Ensure patient can only access their own data
function ensurePatientOwnership(req, res, next) {
    const patientIdFromParam = req.params.patientId;
    const patientIdFromAuth = req.user?.patient_profile_id;
    if (patientIdFromParam !== patientIdFromAuth) {
        return res.status(403).json({ error: 'Access denied: Can only access your own health data' });
    }
    next();
}
router.use(verifyToken);
router.use(requirePatient);
// === PATIENT PROFILE ===
/**
 * Get patient's own health profile
 * GET /api/patients/me/profile
 */
router.get('/me/profile', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const profile = await healthService.getProfile(patientId);
        res.json(profile || { message: 'No profile information recorded' });
    }
    catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Update patient profile
 * PATCH /api/patients/me/profile
 */
router.patch('/me/profile', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const profileData = {
            preferredFirstName: req.body.preferredFirstName,
            preferredLastName: req.body.preferredLastName,
            preferredLanguage: req.body.preferredLanguage,
            emergencyContactName: req.body.emergencyContactName,
            emergencyContactPhone: req.body.emergencyContactPhone,
            emergencyContactRelationship: req.body.emergencyContactRelationship,
            addressLine: req.body.addressLine,
            addressCity: req.body.addressCity,
            addressDistrict: req.body.addressDistrict,
            addressPostalCode: req.body.addressPostalCode,
            notes: req.body.notes,
            source: 'PATIENT',
            verificationStatus: 'SELF_REPORTED',
            recordedAt: new Date().toISOString(),
        };
        const profile = await healthService.createOrUpdateProfile(patientId, profileData);
        res.json({ message: 'Profile updated successfully', profile });
    }
    catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// === ALLERGIES ===
/**
 * Get all patient allergies
 * GET /api/patients/me/allergies
 */
router.get('/me/allergies', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const allergies = await healthService.getAllergies(patientId);
        res.json(allergies.length > 0 ? allergies : { message: 'No allergies reported' });
    }
    catch (error) {
        console.error('Error fetching allergies:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Create new allergy
 * POST /api/patients/me/allergies
 */
router.post('/me/allergies', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        // Validation
        if (!req.body.allergenName) {
            return res.status(400).json({ error: 'Missing required field: allergenName' });
        }
        const allergyData = {
            patientId,
            allergenName: req.body.allergenName,
            allergenCode: req.body.allergenCode,
            allergenSystem: req.body.allergenSystem,
            allergenDisplay: req.body.allergenDisplay,
            reactionText: req.body.reactionText,
            reactionSeverity: req.body.reactionSeverity,
            onsetDate: req.body.onsetDate,
            isMedicallyDiagnosed: req.body.isMedicallyDiagnosed,
            notes: req.body.notes,
            source: 'PATIENT',
            verificationStatus: 'UNVERIFIED',
            recordedAt: new Date().toISOString(),
        };
        const allergy = await healthService.createAllergy(patientId, allergyData);
        res.status(201).json({ message: 'Allergy recorded successfully', allergy });
    }
    catch (error) {
        console.error('Error creating allergy:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Update allergy
 * PATCH /api/patients/me/allergies/:allergyId
 */
router.patch('/me/allergies/:allergyId', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const { allergyId } = req.params;
        const allergyData = {
            allergenName: req.body.allergenName,
            reactionText: req.body.reactionText,
            reactionSeverity: req.body.reactionSeverity,
            notes: req.body.notes,
        };
        const allergy = await healthService.updateAllergy(allergyId, patientId, allergyData);
        res.json({ message: 'Allergy updated successfully', allergy });
    }
    catch (error) {
        if (error.message.includes('unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error updating allergy:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Delete allergy
 * DELETE /api/patients/me/allergies/:allergyId
 */
router.delete('/me/allergies/:allergyId', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const { allergyId } = req.params;
        await healthService.deleteAllergy(allergyId, patientId);
        res.json({ message: 'Allergy deleted successfully' });
    }
    catch (error) {
        if (error.message.includes('unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error deleting allergy:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// === MEDICATIONS ===
/**
 * Get all patient medications
 * GET /api/patients/me/medications
 */
router.get('/me/medications', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const medications = await healthService.getMedications(patientId);
        res.json(medications.length > 0 ? medications : { message: 'No medications reported' });
    }
    catch (error) {
        console.error('Error fetching medications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Create new medication
 * POST /api/patients/me/medications
 */
router.post('/me/medications', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        if (!req.body.medicationName) {
            return res.status(400).json({ error: 'Missing required field: medicationName' });
        }
        const medicationData = {
            patientId,
            medicationName: req.body.medicationName,
            medicationCode: req.body.medicationCode,
            medicationSystem: req.body.medicationSystem,
            medicationDisplay: req.body.medicationDisplay,
            strength: req.body.strength,
            dose: req.body.dose,
            frequency: req.body.frequency,
            route: req.body.route,
            reasonForUse: req.body.reasonForUse,
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            currentlyTaking: req.body.currentlyTaking ?? true,
            notes: req.body.notes,
            source: 'PATIENT',
            verificationStatus: 'UNVERIFIED',
            recordedAt: new Date().toISOString(),
        };
        const medication = await healthService.createMedication(patientId, medicationData);
        res.status(201).json({ message: 'Medication recorded successfully', medication });
    }
    catch (error) {
        console.error('Error creating medication:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Update medication
 * PATCH /api/patients/me/medications/:medicationId
 */
router.patch('/me/medications/:medicationId', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const { medicationId } = req.params;
        const medicationData = {
            medicationName: req.body.medicationName,
            dose: req.body.dose,
            frequency: req.body.frequency,
            currentlyTaking: req.body.currentlyTaking,
            notes: req.body.notes,
        };
        const medication = await healthService.updateMedication(medicationId, patientId, medicationData);
        res.json({ message: 'Medication updated successfully', medication });
    }
    catch (error) {
        if (error.message.includes('unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error updating medication:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Delete medication
 * DELETE /api/patients/me/medications/:medicationId
 */
router.delete('/me/medications/:medicationId', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const { medicationId } = req.params;
        await healthService.deleteMedication(medicationId, patientId);
        res.json({ message: 'Medication deleted successfully' });
    }
    catch (error) {
        if (error.message.includes('unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error deleting medication:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// === CONDITIONS ===
/**
 * Get all patient conditions
 * GET /api/patients/me/conditions
 */
router.get('/me/conditions', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const conditions = await healthService.getConditions(patientId);
        res.json(conditions.length > 0 ? conditions : { message: 'No medical conditions reported' });
    }
    catch (error) {
        console.error('Error fetching conditions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Create new condition
 * POST /api/patients/me/conditions
 */
router.post('/me/conditions', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        if (!req.body.conditionName) {
            return res.status(400).json({ error: 'Missing required field: conditionName' });
        }
        const conditionData = {
            patientId,
            conditionName: req.body.conditionName,
            conditionCode: req.body.conditionCode,
            conditionSystem: req.body.conditionSystem,
            conditionDisplay: req.body.conditionDisplay,
            diagnosisDate: req.body.diagnosisDate,
            status: req.body.status,
            treatingFacility: req.body.treatingFacility,
            notes: req.body.notes,
            source: 'PATIENT',
            verificationStatus: 'UNVERIFIED',
            recordedAt: new Date().toISOString(),
        };
        const condition = await healthService.createCondition(patientId, conditionData);
        res.status(201).json({ message: 'Condition recorded successfully', condition });
    }
    catch (error) {
        console.error('Error creating condition:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Update condition
 * PATCH /api/patients/me/conditions/:conditionId
 */
router.patch('/me/conditions/:conditionId', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const { conditionId } = req.params;
        const conditionData = {
            conditionName: req.body.conditionName,
            status: req.body.status,
            notes: req.body.notes,
        };
        const condition = await healthService.updateCondition(conditionId, patientId, conditionData);
        res.json({ message: 'Condition updated successfully', condition });
    }
    catch (error) {
        if (error.message.includes('unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error updating condition:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Delete condition
 * DELETE /api/patients/me/conditions/:conditionId
 */
router.delete('/me/conditions/:conditionId', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const { conditionId } = req.params;
        await healthService.deleteCondition(conditionId, patientId);
        res.json({ message: 'Condition deleted successfully' });
    }
    catch (error) {
        if (error.message.includes('unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error deleting condition:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// === PROCEDURES ===
/**
 * Get all patient procedures
 * GET /api/patients/me/procedures
 */
router.get('/me/procedures', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const procedures = await healthService.getProcedures(patientId);
        res.json(procedures.length > 0 ? procedures : { message: 'No procedures reported' });
    }
    catch (error) {
        console.error('Error fetching procedures:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Create new procedure
 * POST /api/patients/me/procedures
 */
router.post('/me/procedures', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        if (!req.body.procedureName) {
            return res.status(400).json({ error: 'Missing required field: procedureName' });
        }
        const procedureData = {
            patientId,
            procedureName: req.body.procedureName,
            procedureCode: req.body.procedureCode,
            procedureSystem: req.body.procedureSystem,
            procedureDisplay: req.body.procedureDisplay,
            procedureDate: req.body.procedureDate,
            facilityName: req.body.facilityName,
            notes: req.body.notes,
            source: 'PATIENT',
            verificationStatus: 'UNVERIFIED',
            recordedAt: new Date().toISOString(),
        };
        const procedure = await healthService.createProcedure(patientId, procedureData);
        res.status(201).json({ message: 'Procedure recorded successfully', procedure });
    }
    catch (error) {
        console.error('Error creating procedure:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Update procedure
 * PATCH /api/patients/me/procedures/:procedureId
 */
router.patch('/me/procedures/:procedureId', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const { procedureId } = req.params;
        const procedureData = {
            procedureName: req.body.procedureName,
            facilityName: req.body.facilityName,
            notes: req.body.notes,
        };
        const procedure = await healthService.updateProcedure(procedureId, patientId, procedureData);
        res.json({ message: 'Procedure updated successfully', procedure });
    }
    catch (error) {
        if (error.message.includes('unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error updating procedure:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Delete procedure
 * DELETE /api/patients/me/procedures/:procedureId
 */
router.delete('/me/procedures/:procedureId', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const { procedureId } = req.params;
        await healthService.deleteProcedure(procedureId, patientId);
        res.json({ message: 'Procedure deleted successfully' });
    }
    catch (error) {
        if (error.message.includes('unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error deleting procedure:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// === FAMILY HISTORY ===
/**
 * Get family history
 * GET /api/patients/me/family-history
 */
router.get('/me/family-history', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const family = await healthService.getFamilyMembers(patientId);
        res.json(family.length > 0 ? family : { message: 'No family health history recorded' });
    }
    catch (error) {
        console.error('Error fetching family history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Create family member
 * POST /api/patients/me/family-history
 */
router.post('/me/family-history', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        if (!req.body.relationship) {
            return res.status(400).json({ error: 'Missing required field: relationship' });
        }
        const familyData = {
            patientId,
            relativeName: req.body.relativeName,
            relationship: req.body.relationship,
            conditionName: req.body.conditionName,
            conditionCode: req.body.conditionCode,
            conditionSystem: req.body.conditionSystem,
            conditionDisplay: req.body.conditionDisplay,
            onsetDate: req.body.onsetDate,
            notes: req.body.notes,
            source: 'PATIENT',
            verificationStatus: 'UNVERIFIED',
            recordedAt: new Date().toISOString(),
        };
        const family = await healthService.createFamilyMember(patientId, familyData);
        res.status(201).json({ message: 'Family history recorded successfully', family });
    }
    catch (error) {
        console.error('Error creating family member:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Update family member
 * PATCH /api/patients/me/family-history/:familyId
 */
router.patch('/me/family-history/:familyId', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const { familyId } = req.params;
        const familyData = {
            relativeName: req.body.relativeName,
            conditionName: req.body.conditionName,
            notes: req.body.notes,
        };
        const family = await healthService.updateFamilyMember(familyId, patientId, familyData);
        res.json({ message: 'Family history updated successfully', family });
    }
    catch (error) {
        if (error.message.includes('unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error updating family member:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Delete family member
 * DELETE /api/patients/me/family-history/:familyId
 */
router.delete('/me/family-history/:familyId', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const { familyId } = req.params;
        await healthService.deleteFamilyMember(familyId, patientId);
        res.json({ message: 'Family history deleted successfully' });
    }
    catch (error) {
        if (error.message.includes('unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error deleting family member:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// === SOCIAL HISTORY ===
/**
 * Get social history
 * GET /api/patients/me/social-history
 */
router.get('/me/social-history', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const social = await healthService.getSocialHistory(patientId);
        res.json(social || { message: 'No social history recorded' });
    }
    catch (error) {
        console.error('Error fetching social history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Create or update social history
 * POST /api/patients/me/social-history
 */
router.post('/me/social-history', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const socialData = {
            smokingStatus: req.body.smokingStatus,
            smokingFrequency: req.body.smokingFrequency,
            tobaccoUse: req.body.tobaccoUse,
            tobaccoFrequency: req.body.tobaccoFrequency,
            physicalActivity: req.body.physicalActivity,
            activityNotes: req.body.activityNotes,
            occupation: req.body.occupation,
            sleepHours: req.body.sleepHours,
            sleepQuality: req.body.sleepQuality,
            otherRiskFactors: req.body.otherRiskFactors,
            source: 'PATIENT',
            verificationStatus: 'UNVERIFIED',
            recordedAt: new Date().toISOString(),
        };
        const social = await healthService.createOrUpdateSocialHistory(patientId, socialData);
        res.json({ message: 'Social history saved successfully', social });
    }
    catch (error) {
        console.error('Error creating/updating social history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// === VITAL OBSERVATIONS ===
/**
 * Get vital observations
 * GET /api/patients/me/vitals
 */
router.get('/me/vitals', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const observationType = req.query.type;
        const vitals = await healthService.getVitalObservations(patientId, observationType);
        res.json(vitals.length > 0 ? vitals : { message: 'No vital measurements recorded' });
    }
    catch (error) {
        console.error('Error fetching vitals:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Create vital observation
 * POST /api/patients/me/vitals
 */
router.post('/me/vitals', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        if (!req.body.observationType || !req.body.recordedAt) {
            return res.status(400).json({ error: 'Missing required fields: observationType, recordedAt' });
        }
        // Validate numeric values if present
        if (req.body.valueQuantity !== undefined && (isNaN(req.body.valueQuantity) || req.body.valueQuantity < -500 || req.body.valueQuantity > 500)) {
            return res.status(400).json({ error: 'Invalid value_quantity: must be a valid number' });
        }
        const vitalData = {
            patientId,
            observationType: req.body.observationType,
            observationCode: req.body.observationCode,
            observationSystem: req.body.observationSystem,
            observationDisplay: req.body.observationDisplay,
            valueQuantity: req.body.valueQuantity,
            valueUnit: req.body.valueUnit,
            valueText: req.body.valueText,
            systolic: req.body.systolic,
            diastolic: req.body.diastolic,
            deviceName: req.body.deviceName,
            deviceManufacturer: req.body.deviceManufacturer,
            deviceModel: req.body.deviceModel,
            deviceIdentifier: req.body.deviceIdentifier,
            measurementMethod: req.body.measurementMethod || 'MANUAL_ENTRY',
            recordedAt: req.body.recordedAt,
            measurementNotes: req.body.measurementNotes,
            source: 'PATIENT',
            verificationStatus: 'UNVERIFIED',
        };
        const vital = await healthService.createVitalObservation(patientId, vitalData);
        res.status(201).json({ message: 'Vital measurement recorded successfully', vital });
    }
    catch (error) {
        console.error('Error creating vital:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Delete vital observation
 * DELETE /api/patients/me/vitals/:vitalId
 */
router.delete('/me/vitals/:vitalId', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const { vitalId } = req.params;
        await healthService.deleteVitalObservation(vitalId, patientId);
        res.json({ message: 'Vital measurement deleted successfully' });
    }
    catch (error) {
        if (error.message.includes('unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error deleting vital:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// === DOCUMENTS ===
/**
 * Get uploaded documents
 * GET /api/patients/me/documents
 */
router.get('/me/documents', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const category = req.query.category;
        const documents = await healthService.getDocuments(patientId, category);
        res.json(documents.length > 0 ? documents : { message: 'No medical documents uploaded' });
    }
    catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Upload document metadata (file storage is handled separately)
 * POST /api/patients/me/documents
 */
router.post('/me/documents', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        if (!req.body.filename || !req.body.fileMimetype || req.body.fileSizeBytes === undefined) {
            return res.status(400).json({ error: 'Missing required fields: filename, fileMimetype, fileSizeBytes' });
        }
        if (!req.body.documentCategory) {
            return res.status(400).json({ error: 'Missing required field: documentCategory' });
        }
        const documentData = {
            patientId,
            filename: req.body.filename,
            fileMimetype: req.body.fileMimetype,
            fileSizeBytes: req.body.fileSizeBytes,
            documentCategory: req.body.documentCategory,
            documentDescription: req.body.documentDescription,
            storageReference: req.body.storageReference || `patient-docs/${patientId}/${req.body.filename}`,
            processingStatus: 'UPLOADED',
            extractedData: undefined,
            extractionError: undefined,
            verificationStatus: 'UNVERIFIED',
            verificationNotes: undefined,
            source: 'PATIENT',
            uploadTimestamp: new Date().toISOString(),
        };
        const document = await healthService.createDocument(patientId, documentData);
        res.status(201).json({ message: 'Document uploaded successfully', document });
    }
    catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Delete document
 * DELETE /api/patients/me/documents/:documentId
 */
router.delete('/me/documents/:documentId', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const { documentId } = req.params;
        await healthService.deleteDocument(documentId, patientId);
        res.json({ message: 'Document deleted successfully' });
    }
    catch (error) {
        if (error.message.includes('unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// === COMPOSITE VIEW ===
/**
 * Get full patient health profile
 * GET /api/patients/me/health-profile
 */
router.get('/me/health-profile', async (req, res) => {
    try {
        const patientId = req.user.patient_profile_id;
        const profile = await healthService.getPatientHealthProfile(patientId);
        res.json(profile);
    }
    catch (error) {
        console.error('Error fetching health profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
export const patientReportedHealthRoutes = router;
//# sourceMappingURL=patient-reported-health-routes.js.map