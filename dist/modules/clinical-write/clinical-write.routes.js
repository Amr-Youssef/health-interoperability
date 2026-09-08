import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';
import { prisma } from '../../lib/prisma.js';
import { v4 as uuidv4 } from 'uuid';
export function createClinicalWriteRoutes(canonicalStore) {
    const router = Router();
    router.use(verifyToken);
    const needWrite = requirePermission('CLINICAL_WRITE_ORG');
    const needEncounter = requirePermission('ENCOUNTER_CREATE_ORG');
    router.post('/encounter', needEncounter, async (req, res) => {
        try {
            const user = req.user;
            const { patientId, encounterClass, periodStart, periodEnd, department, departmentAr, priority } = req.body;
            if (!patientId || !encounterClass)
                return res.status(400).json({ error: 'patientId و encounterClass مطلوبان' });
            const pat = await prisma.patient.findFirst({ where: { OR: [{ id: patientId }, { internal_id: patientId }] } });
            if (!pat)
                return res.status(404).json({ error: 'المريض غير موجود' });
            const link = await prisma.patientOrganization.findFirst({ where: { patient_id: pat.id, organization_id: user.organization_id, active: true } });
            const direct = pat.source_system_id === user.organization_id;
            if (!link && !direct) {
                const appt = await prisma.appointment.findFirst({ where: { patient_id: pat.internal_id, organization_id: user.organization_id, status: { in: ['booked', 'arrived', 'fulfilled'] } }, include: { consent: true } });
                const ok = appt?.consent && appt.consent.granted && !appt.consent.revoked_at && (!appt.consent.expires_at || new Date(appt.consent.expires_at) > new Date());
                if (!ok)
                    return res.status(403).json({ error: 'المريض غير مرتبط بمنشأتك ولا يوجد موعد/إذن فعال — احجز موعد أو استخدم كسر الزجاج' });
            }
            const enc = {
                internalId: `enc-${uuidv4()}`,
                patientId: pat.internal_id,
                sourceVisitId: `VIS-${Date.now()}`,
                status: 'finished',
                class: encounterClass,
                priority: priority || 'routine',
                department: department || 'General',
                departmentAr: departmentAr || 'عام',
                period: { start: periodStart || new Date().toISOString(), end: periodEnd || new Date().toISOString() },
                provenance: { sourceSystemId: user.organization_id, sourceRecordId: `enc-${Date.now()}`, rawRecordId: 'clinical-write', mappingVersion: '1.0', validationScore: 100, adapterVersion: '1.0' }
            };
            await canonicalStore.saveEncounter(enc);
            await prisma.auditLog.create({ data: { entity_type: 'Encounter', entity_id: enc.internalId, action: 'CLINICAL_WRITE_ENCOUNTER', actor_id: user.id, organization_id: user.organization_id, new_values: JSON.stringify(enc), details: `Clinician ${user.username} created encounter ${enc.internalId} for patient ${pat.internal_id}` } }).catch(() => { });
            res.json({ success: true, encounter: enc });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/condition', needWrite, async (req, res) => {
        try {
            const user = req.user;
            const { patientId, encounterId, code, codeDisplay, clinicalStatus, verificationStatus, onsetDate, severity, notes } = req.body;
            if (!patientId || !code)
                return res.status(400).json({ error: 'patientId و code مطلوبان' });
            const pat = await prisma.patient.findFirst({ where: { OR: [{ id: patientId }, { internal_id: patientId }] } });
            if (!pat)
                return res.status(404).json({ error: 'المريض غير موجود' });
            const cond = {
                internalId: `cond-${uuidv4()}`,
                patientId: pat.internal_id,
                encounterId: encounterId || null,
                code: { sourceCode: code, sourceDisplay: codeDisplay || code, snomedCode: code, icd10amCode: code },
                clinicalStatus: clinicalStatus || 'active',
                verificationStatus: verificationStatus || 'confirmed',
                severity: severity || null,
                onsetDateTime: onsetDate ? new Date(onsetDate).toISOString() : null,
                recordedDate: new Date().toISOString(),
                note: notes || null,
                provenance: { sourceSystemId: user.organization_id, sourceRecordId: `cond-${Date.now()}`, rawRecordId: 'clinical-write', mappingVersion: '1.0', validationScore: 100, adapterVersion: '1.0' }
            };
            await canonicalStore.saveCondition(cond);
            await prisma.auditLog.create({ data: { entity_type: 'Condition', entity_id: cond.internalId, action: 'CLINICAL_WRITE_CONDITION', actor_id: user.id, organization_id: user.organization_id, new_values: JSON.stringify(cond), details: `Clinician created condition ${code}` } }).catch(() => { });
            res.json({ success: true, condition: cond });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/observation', needWrite, async (req, res) => {
        try {
            const user = req.user;
            const { patientId, encounterId, code, display, value, unit, status, method, interpretation } = req.body;
            if (!patientId || !code || value === undefined)
                return res.status(400).json({ error: 'patientId و code و value مطلوبة' });
            const pat = await prisma.patient.findFirst({ where: { OR: [{ id: patientId }, { internal_id: patientId }] } });
            if (!pat)
                return res.status(404).json({ error: 'المريض غير موجود' });
            const obs = {
                internalId: `obs-${uuidv4()}`,
                patientId: pat.internal_id,
                encounterId: encounterId || null,
                code: { sourceCode: code, sourceDisplay: display || code, loincCode: code },
                valueQuantity: { value: Number(value), unit: unit || '' },
                status: status || 'final',
                method: method || 'manual',
                interpretation: interpretation || null,
                effectiveDateTime: new Date().toISOString(),
                provenance: { sourceSystemId: user.organization_id, sourceRecordId: `obs-${Date.now()}`, rawRecordId: 'clinical-write', mappingVersion: '1.0', validationScore: 100, adapterVersion: '1.0' }
            };
            await canonicalStore.saveObservation(obs);
            await prisma.auditLog.create({ data: { entity_type: 'Observation', entity_id: obs.internalId, action: 'CLINICAL_WRITE_OBSERVATION', actor_id: user.id, organization_id: user.organization_id, new_values: JSON.stringify(obs), details: `Clinician created observation ${code}=${value}` } }).catch(() => { });
            res.json({ success: true, observation: obs });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/diagnostic-report', needWrite, async (req, res) => {
        try {
            const user = req.user;
            const { patientId, encounterId, code, display, conclusion, status } = req.body;
            if (!patientId || !code)
                return res.status(400).json({ error: 'patientId و code مطلوبان' });
            const pat = await prisma.patient.findFirst({ where: { OR: [{ id: patientId }, { internal_id: patientId }] } });
            if (!pat)
                return res.status(404).json({ error: 'المريض غير موجود' });
            const rep = {
                internalId: `dr-${uuidv4()}`,
                patientId: pat.internal_id,
                encounterId: encounterId || null,
                code: { sourceCode: code, sourceDisplay: display || code, loincCode: code },
                status: status || 'final',
                issued: new Date().toISOString(),
                conclusion: conclusion || '',
                provenance: { sourceSystemId: user.organization_id, sourceRecordId: `dr-${Date.now()}`, rawRecordId: 'clinical-write', mappingVersion: '1.0', validationScore: 100, adapterVersion: '1.0' }
            };
            await canonicalStore.saveDiagnosticReport(rep);
            await prisma.auditLog.create({ data: { entity_type: 'DiagnosticReport', entity_id: rep.internalId, action: 'CLINICAL_WRITE_REPORT', actor_id: user.id, organization_id: user.organization_id, new_values: JSON.stringify(rep), details: `Clinician created diagnostic report ${code}` } }).catch(() => { });
            res.json({ success: true, report: rep });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/allergy', needWrite, async (req, res) => {
        try {
            const user = req.user;
            const { patientId, code, display, criticality, type } = req.body;
            if (!patientId || !code)
                return res.status(400).json({ error: 'patientId و code مطلوبان' });
            const pat = await prisma.patient.findFirst({ where: { OR: [{ id: patientId }, { internal_id: patientId }] } });
            if (!pat)
                return res.status(404).json({ error: 'المريض غير موجود' });
            const alg = { internalId: `alg-${uuidv4()}`, patientId: pat.internal_id, code: { sourceCode: code, snomedCode: code, sourceDisplay: display || code }, criticality: criticality || 'high', type: type || 'allergy', recordedDate: new Date().toISOString(), provenance: { sourceSystemId: user.organization_id, sourceRecordId: `alg-${Date.now()}`, rawRecordId: 'clinical-write', mappingVersion: '1.0', validationScore: 100, adapterVersion: '1.0' } };
            await canonicalStore.saveAllergyIntolerance(alg);
            await prisma.auditLog.create({ data: { entity_type: 'AllergyIntolerance', entity_id: alg.internalId, action: 'CLINICAL_WRITE_ALLERGY', actor_id: user.id, organization_id: user.organization_id, new_values: JSON.stringify(alg), details: `Clinician created allergy ${code}` } }).catch(() => { });
            res.json({ success: true, allergy: alg });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/immunization', needWrite, async (req, res) => {
        try {
            const user = req.user;
            const { patientId, encounterId, vaccineCode, display, lotNumber, status } = req.body;
            if (!patientId || !vaccineCode)
                return res.status(400).json({ error: 'patientId و vaccineCode مطلوبان' });
            const pat = await prisma.patient.findFirst({ where: { OR: [{ id: patientId }, { internal_id: patientId }] } });
            if (!pat)
                return res.status(404).json({ error: 'المريض غير موجود' });
            const imm = { internalId: `imm-${uuidv4()}`, patientId: pat.internal_id, encounterId: encounterId || null, vaccineCode: { sourceCode: vaccineCode, cvxCode: vaccineCode, sourceDisplay: display || vaccineCode }, status: status || 'completed', lotNumber: lotNumber || `LOT-${Date.now()}`, occurrenceDateTime: new Date().toISOString(), provenance: { sourceSystemId: user.organization_id, sourceRecordId: `imm-${Date.now()}`, rawRecordId: 'clinical-write', mappingVersion: '1.0', validationScore: 100, adapterVersion: '1.0' } };
            await canonicalStore.saveImmunization(imm);
            await prisma.auditLog.create({ data: { entity_type: 'Immunization', entity_id: imm.internalId, action: 'CLINICAL_WRITE_IMMUNIZATION', actor_id: user.id, organization_id: user.organization_id, new_values: JSON.stringify(imm), details: `Clinician created immunization ${vaccineCode}` } }).catch(() => { });
            res.json({ success: true, immunization: imm });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/medication', needWrite, async (req, res) => {
        try {
            const user = req.user;
            const { patientId, encounterId, code, display, dosage, status } = req.body;
            if (!patientId || !code)
                return res.status(400).json({ error: 'patientId و code مطلوبان' });
            const pat = await prisma.patient.findFirst({ where: { OR: [{ id: patientId }, { internal_id: patientId }] } });
            if (!pat)
                return res.status(404).json({ error: 'المريض غير موجود' });
            const med = { internalId: `med-${uuidv4()}`, patientId: pat.internal_id, encounterId: encounterId || null, medication: { code: { sourceCode: code, sfdaCode: code, sourceDisplay: display || code } }, dosageInstruction: [{ text: dosage || 'حسب الوصفة' }], status: status || 'active', authoredOn: new Date().toISOString(), provenance: { sourceSystemId: user.organization_id, sourceRecordId: `med-${Date.now()}`, rawRecordId: 'clinical-write', mappingVersion: '1.0', validationScore: 100, adapterVersion: '1.0' } };
            await canonicalStore.saveMedicationRequest(med);
            await prisma.auditLog.create({ data: { entity_type: 'MedicationRequest', entity_id: med.internalId, action: 'CLINICAL_WRITE_MEDICATION', actor_id: user.id, organization_id: user.organization_id, new_values: JSON.stringify(med), details: `Clinician created medication ${code}` } }).catch(() => { });
            res.json({ success: true, medication: med });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    return router;
}
//# sourceMappingURL=clinical-write.routes.js.map