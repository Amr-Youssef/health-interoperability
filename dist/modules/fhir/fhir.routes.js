import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/jwt.js';
import { prisma } from '../../lib/prisma.js';
function getQueryString(val) {
    if (typeof val === 'string')
        return val;
    if (Array.isArray(val))
        return val[0] || '';
    return '';
}
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
export function createFhirRoutes(canonicalStore, fhirSerializer, engine) {
    const router = Router();
    router.get('/metadata', (req, res) => {
        res.json({
            resourceType: 'CapabilityStatement', status: 'active', date: new Date().toISOString(),
            publisher: 'Saudi National Health Interoperability Platform (Prototype v0.2.4)',
            kind: 'instance',
            software: { name: 'Saudi Interoperability Normalization Engine, NPHIES, SFDA Drug, CDS & Bulk Export Gateway', version: '0.2.4' },
            fhirVersion: '4.0.1', format: ['json'],
            rest: [{ mode: 'server', resource: [
                        { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }] },
                        { type: 'Encounter', interaction: [{ code: 'read' }, { code: 'search-type' }] },
                        { type: 'Condition', interaction: [{ code: 'read' }, { code: 'search-type' }] },
                        { type: 'Observation', interaction: [{ code: 'read' }, { code: 'search-type' }] },
                        { type: 'Coverage', interaction: [{ code: 'read' }, { code: 'search-type' }] },
                        { type: 'Claim', interaction: [{ code: 'read' }, { code: 'search-type' }] },
                        { type: 'ClaimResponse', interaction: [{ code: 'read' }, { code: 'search-type' }] },
                        { type: 'MedicationRequest', interaction: [{ code: 'read' }, { code: 'search-type' }] },
                        { type: 'Immunization', interaction: [{ code: 'read' }, { code: 'search-type' }] }
                    ], operation: [{ name: 'export', definition: 'http://hl7.org/fhir/uv/bulkdata/OperationDefinition/export' }] }]
        });
    });
    router.get('/$export', verifyToken, requirePermission('EXPORT_BULK_ANONYMIZED', 'EXPORT_BULK_IDENTIFIED'), async (req, res) => {
        try {
            const anonymize = getQueryString(req.query.anonymize) === 'true' || getQueryString(req.query.deidentify) === 'true';
            const typesStr = getQueryString(req.query._type);
            const types = typesStr ? typesStr.split(',') : undefined;
            const result = await engine.bulkExportService.exportBulkData({ anonymize, resourceTypes: types });
            await engine.auditChain.recordEvent('BULK_EXPORT', 'FHIR_CLIENT', 'BulkExportResult', `export-${Date.now()}`, `Exported ${result.totalResourcesExported} resources (Anonymized: ${anonymize})`);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: err.message }] });
        }
    });
    router.get('/Patient/$export', verifyToken, requirePermission('EXPORT_BULK_ANONYMIZED', 'EXPORT_BULK_IDENTIFIED'), async (req, res) => {
        try {
            const anonymize = getQueryString(req.query.anonymize) === 'true' || getQueryString(req.query.deidentify) === 'true';
            const typesStr = getQueryString(req.query._type);
            const types = typesStr ? typesStr.split(',') : undefined;
            const result = await engine.bulkExportService.exportBulkData({ anonymize, resourceTypes: types });
            await engine.auditChain.recordEvent('BULK_EXPORT', 'FHIR_CLIENT', 'BulkExportResult', `export-${Date.now()}`, `Exported ${result.totalResourcesExported} resources (Anonymized: ${anonymize})`);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: err.message }] });
        }
    });
    router.get('/Patient', verifyToken, requirePermission('FHIR_READ_SELF', 'FHIR_READ_ORG', 'FHIR_READ_ALL'), async (req, res) => {
        const identifier = getQueryString(req.query.identifier);
        let patients = await canonicalStore.getAllPatients();
        if (identifier)
            patients = patients.filter((p) => p.identifiers.some((id) => id.value.includes(identifier)));
        res.json({ resourceType: 'Bundle', type: 'searchset', total: patients.length, entry: patients.map((p) => ({ fullUrl: `/fhir/Patient/${p.internalId}`, resource: fhirSerializer.serializePatient(p) })) });
    });
    router.get('/Patient/:id', verifyToken, requirePermission('FHIR_READ_SELF', 'FHIR_READ_ORG', 'FHIR_READ_ALL'), async (req, res) => {
        const patientId = req.params.id;
        const token = (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : req.cookies?.shiep_token) || null;
        let user = req.user;
        if (!user && token) {
            try {
                const d = jwt.verify(token, JWT_SECRET);
                user = await prisma.user.findUnique({ where: { id: d.userId }, include: { role: true } });
            }
            catch { }
        }
        if (user?.role?.role_code === 'PATIENT') {
            const target = await resolvePatientInternalId(user, canonicalStore);
            if (target !== patientId)
                return res.status(403).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'forbidden', diagnostics: 'Patients can only read own record' }] });
        }
        const patient = await canonicalStore.getPatient(patientId);
        if (!patient)
            return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Patient not found' }] });
        res.json(fhirSerializer.serializePatient(patient));
    });
    router.get('/Patient/:id/$everything', verifyToken, requirePermission('FHIR_READ_SELF', 'FHIR_READ_ORG', 'FHIR_READ_ALL'), async (req, res) => {
        const patientId = req.params.id;
        const record = await canonicalStore.getLongitudinalRecord(patientId);
        if (!record)
            return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Patient not found' }] });
        res.json(fhirSerializer.serializeLongitudinalBundle(record));
    });
    const bindSearch = (type, getter, serializer) => {
        router.get(`/${type}`, verifyToken, requirePermission('FHIR_READ_SELF', 'FHIR_READ_ORG', 'FHIR_READ_ALL'), async (req, res) => {
            const patientId = getQueryString(req.query.patient);
            let list = await canonicalStore[getter]();
            if (patientId)
                list = list.filter((e) => e.patientId === patientId);
            res.json({ resourceType: 'Bundle', type: 'searchset', total: list.length, entry: list.map((e) => ({ fullUrl: `/fhir/${type}/${e.internalId}`, resource: fhirSerializer[serializer](e) })) });
        });
    };
    bindSearch('Encounter', 'getAllEncounters', 'serializeEncounter');
    bindSearch('Condition', 'getAllConditions', 'serializeCondition');
    bindSearch('Observation', 'getAllObservations', 'serializeObservation');
    bindSearch('Coverage', 'getAllCoverages', 'serializeCoverage');
    bindSearch('Claim', 'getAllClaims', 'serializeClaim');
    bindSearch('MedicationRequest', 'getAllMedicationRequests', 'serializeMedicationRequest');
    bindSearch('Immunization', 'getAllImmunizations', 'serializeImmunization');
    bindSearch('AllergyIntolerance', 'getAllAllergies', 'serializeAllergyIntolerance');
    bindSearch('DiagnosticReport', 'getAllDiagnosticReports', 'serializeDiagnosticReport');
    router.get('/ClaimResponse', verifyToken, requirePermission('FHIR_READ_SELF', 'FHIR_READ_ORG', 'FHIR_READ_ALL'), async (_req, res) => {
        const claims = await canonicalStore.getAllClaims();
        const responses = [];
        for (const c of claims) {
            const r = await canonicalStore.getClaimResponse(c.internalId);
            if (r)
                responses.push(fhirSerializer.serializeClaimResponse(r));
        }
        res.json({ resourceType: 'Bundle', type: 'searchset', total: responses.length, entry: responses.map(r => ({ fullUrl: `/fhir/ClaimResponse/${r.id}`, resource: r })) });
    });
    router.get('/Consent', verifyToken, requirePermission('FHIR_READ_SELF', 'FHIR_READ_ORG', 'FHIR_READ_ALL'), async (req, res) => {
        const patientId = getQueryString(req.query.patient);
        const patients = await canonicalStore.getAllPatients();
        const targetPatients = patientId ? patients.filter((p) => p.internalId === patientId) : patients;
        const consents = await Promise.all(targetPatients.map((p) => engine.consentManager.getConsent(p.internalId)));
        res.json({ resourceType: 'Bundle', type: 'searchset', total: consents.length, entry: consents.map(c => ({ fullUrl: `/fhir/Consent/consent-${c.patientId}`, resource: fhirSerializer.serializeConsent(c) })) });
    });
    return router;
}
//# sourceMappingURL=fhir.routes.js.map