import { Router, Request, Response } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';
import type { ICanonicalStore } from '../../persistence/canonical-store.interface.js';
import type { FhirR4Serializer } from '../../fhir/fhir-serializer.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/jwt.js';
import { prisma } from '../../lib/prisma.js';

function getQueryString(val: any): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val[0] || '';
  return '';
}

async function resolvePatientInternalId(user: any, canonicalStore: any): Promise<string | null> {
  if (!user) return null;
  if (user.patient_profile_id) {
    const p = await canonicalStore.getPatient(user.patient_profile_id);
    if (p) return p.internalId;
  }
  const byNid = await canonicalStore.findPatientByIdentifier(user.username);
  if (byNid) return byNid.internalId;
  return user.patient_profile_id || null;
}

async function canAccessPatient(user: any, patientId: string, canonicalStore: any): Promise<boolean> {
  const role = user?.role?.role_code;
  if (role === 'SYS_ADMIN' || role === 'MOH_ADMIN' || role === 'MOH_AUDITOR') return true;
  if (role === 'PATIENT') return (await resolvePatientInternalId(user, canonicalStore)) === patientId;
  if (!['HOSPITAL_ADMIN', 'CLINICIAN'].includes(role)) return false;

  const patient = await prisma.patient.findFirst({
    where: { OR: [{ internal_id: patientId }, { id: patientId }] },
    select: { id: true, internal_id: true, source_system_id: true }
  });
  if (!patient) return false;
  if (patient.source_system_id === user.organization_id) return true;

  const linked = await prisma.patientOrganization.findFirst({
    where: { patient_id: patient.id, organization_id: user.organization_id, active: true },
    select: { id: true }
  });
  if (linked) return true;

  const appointment = await prisma.appointment.findFirst({
    where: {
      patient_id: { in: [patient.id, patient.internal_id] },
      organization_id: user.organization_id,
      status: { in: ['booked', 'arrived', 'fulfilled'] }
    },
    include: { consent: true }
  });
  const consent = appointment?.consent;
  if (!appointment || !consent?.granted || consent.revoked_at || (consent.expires_at && consent.expires_at <= new Date())) return false;
  return role !== 'CLINICIAN' || !appointment.clinician_id || appointment.clinician_id === user.id;
}

export function createFhirRoutes(canonicalStore: ICanonicalStore & any, fhirSerializer: FhirR4Serializer, engine: any) {
  const router = Router();

  router.get('/metadata', (req: Request, res: Response) => {
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

  router.get('/$export', verifyToken as any, requirePermission('EXPORT_BULK_ANONYMIZED','EXPORT_BULK_IDENTIFIED') as any, async (req: Request, res: Response) => {
    try {
      const anonymize = getQueryString(req.query.anonymize as any) === 'true' || getQueryString(req.query.deidentify as any) === 'true';
      const typesStr = getQueryString(req.query._type as any);
      const types = typesStr ? typesStr.split(',') : undefined;
      const result = await engine.bulkExportService.exportBulkData({ anonymize, resourceTypes: types });
      await engine.auditChain.recordEvent('BULK_EXPORT','FHIR_CLIENT','BulkExportResult',`export-${Date.now()}`,`Exported ${result.totalResourcesExported} resources (Anonymized: ${anonymize})`);
      res.json(result);
    } catch (err: any) { res.status(500).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: err.message }] }); }
  });
  router.get('/Patient/$export', verifyToken as any, requirePermission('EXPORT_BULK_ANONYMIZED','EXPORT_BULK_IDENTIFIED') as any, async (req: Request, res: Response) => {
    try {
      const anonymize = getQueryString(req.query.anonymize as any) === 'true' || getQueryString(req.query.deidentify as any) === 'true';
      const typesStr = getQueryString(req.query._type as any);
      const types = typesStr ? typesStr.split(',') : undefined;
      const result = await engine.bulkExportService.exportBulkData({ anonymize, resourceTypes: types });
      await engine.auditChain.recordEvent('BULK_EXPORT','FHIR_CLIENT','BulkExportResult',`export-${Date.now()}`,`Exported ${result.totalResourcesExported} resources (Anonymized: ${anonymize})`);
      res.json(result);
    } catch (err: any) { res.status(500).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: err.message }] }); }
  });

  router.get('/Patient', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
    const user: any = (req as any).user;
    const identifier = getQueryString(req.query.identifier as any);
    if (user?.role?.role_code === 'PATIENT') {
      const ownId = await resolvePatientInternalId(user, canonicalStore);
      const patient = ownId ? await canonicalStore.getPatient(ownId) : null;
      return res.json({ resourceType: 'Bundle', type: 'searchset', total: patient ? 1 : 0, entry: patient ? [{ fullUrl: `/fhir/Patient/${patient.internalId}`, resource: fhirSerializer.serializePatient(patient) }] : [] });
    }
    const count = Math.min(Math.max(parseInt(String(req.query._count || '20'), 10) || 20, 1), 50);
    const offset = Math.max(parseInt(String(req.query._offset || '0'), 10) || 0, 0);
    const result = canonicalStore.searchPatients
      ? await canonicalStore.searchPatients({ q: identifier, skip: offset, take: count, sort: 'recent', organizationId: ['HOSPITAL_ADMIN','CLINICIAN'].includes(user?.role?.role_code) ? user.organization_id : undefined } as any)
    : await (async () => {
      const all = await canonicalStore.getAllPatients();
      const filtered = identifier ? all.filter((p: any) => p.identifiers?.some((id: any) => id.value.includes(identifier))) : all;
      return { items: filtered.slice(offset, offset + count), total: filtered.length };
    })();
    let patients = result.items;
    const mask = ['HOSPITAL_ADMIN','CLINICIAN'].includes(user?.role?.role_code);
    res.json({ resourceType: 'Bundle', type: 'searchset', total: result.total, entry: patients.map((p: any) => ({ fullUrl: `/fhir/Patient/${p.internalId}`, resource: fhirSerializer.serializePatient(p, { maskNid: mask }) })) });
  });

  router.get('/Patient/:id', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
    const patientId = req.params.id as string;
    const token = (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : (req as any).cookies?.shiep_token) || null;
    let user: any = (req as any).user;
    if (!user && token) {
      try { const d: any = jwt.verify(token, JWT_SECRET); user = await prisma.user.findUnique({ where: { id: d.userId }, include: { role: true } }); } catch {}
    }
    if (!await canAccessPatient(user, patientId, canonicalStore)) {
      return res.status(403).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'forbidden', diagnostics: 'Patient record is outside the permitted scope' }] });
    }
    const patient = await canonicalStore.getPatient(patientId);
    if (!patient) return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Patient not found' }] });
    const mask = ['HOSPITAL_ADMIN','CLINICIAN'].includes(user?.role?.role_code);
    res.json(fhirSerializer.serializePatient(patient, { maskNid: mask }));
  });

  router.get('/Patient/:id/$everything', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
    const patientId = req.params.id as string;
    if (!await canAccessPatient((req as any).user, patientId, canonicalStore)) {
      return res.status(403).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'forbidden', diagnostics: 'Patient record is outside the permitted scope' }] });
    }
    const record = await canonicalStore.getLongitudinalRecord(patientId);
    if (!record) return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Patient not found' }] });
    res.json(fhirSerializer.serializeLongitudinalBundle(record));
  });

  router.post('/:type/$validate', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req, res) => {
    const type = req.params.type as string;
    const resource = req.body;
    if (!resource || resource.resourceType !== type) return res.status(400).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid', diagnostics: `resourceType must be ${type}` }] });
    const required = type==='Patient' ? ['identifier'] : type==='Observation' ? ['status','code'] : [];
    const missing = required.filter(f=> !resource[f]);
    if (missing.length) return res.status(400).json({ resourceType: 'OperationOutcome', issue: missing.map(f=> ({ severity: 'error', code: 'required', diagnostics: `Missing ${f}` })) });
    res.json({ resourceType: 'OperationOutcome', issue: [{ severity: 'information', code: 'informational', diagnostics: 'Validation passed (mock $validate)' }] });
  });
  const bindSearch = (type: string, getter: string, serializer: string) => {
    router.get(`/${type}`, verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
      const user: any = (req as any).user;
      const patientId = getQueryString((req.query as any).patient);
      const count = Math.min(parseInt(String(req.query._count || '20'),10)||20, 50);
      const offset = Math.max(parseInt(String(req.query._offset || '0'),10)||0,0);
      const result = canonicalStore.searchFhirResources
        ? await canonicalStore.searchFhirResources(type, { patientId, skip: offset, take: count, organizationId: ['HOSPITAL_ADMIN','CLINICIAN'].includes(user?.role?.role_code) ? user.organization_id : undefined })
        : await (async () => {
          const all = await (canonicalStore as any)[getter]();
          const filtered = patientId ? all.filter((e: any) => e.patientId === patientId) : all;
          return { items: filtered.slice(offset, offset + count), total: filtered.length };
        })();
      const paged = result.items;
      const total = result.total;
      const base = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
      const link: any[] = [{ relation: 'self', url: `${base}?_count=${count}&_offset=${offset}${patientId?`&patient=${patientId}`:''}` }];
      if (offset+count < total) link.push({ relation: 'next', url: `${base}?_count=${count}&_offset=${offset+count}${patientId?`&patient=${patientId}`:''}` });
      if (offset>0) link.push({ relation: 'previous', url: `${base}?_count=${count}&_offset=${Math.max(0,offset-count)}${patientId?`&patient=${patientId}`:''}` });
      res.json({ resourceType: 'Bundle', type: 'searchset', total, entry: paged.map((e: any) => ({ fullUrl: `/fhir/${type}/${e.internalId}`, resource: (fhirSerializer as any)[serializer](e) })), link });
    });
  };
  bindSearch('Encounter','getAllEncounters','serializeEncounter');
  bindSearch('Condition','getAllConditions','serializeCondition');
  bindSearch('Observation','getAllObservations','serializeObservation');
  bindSearch('Coverage','getAllCoverages','serializeCoverage');
  bindSearch('Claim','getAllClaims','serializeClaim');
  bindSearch('MedicationRequest','getAllMedicationRequests','serializeMedicationRequest');
  bindSearch('Immunization','getAllImmunizations','serializeImmunization');
  bindSearch('AllergyIntolerance','getAllAllergies','serializeAllergyIntolerance');
  bindSearch('DiagnosticReport','getAllDiagnosticReports','serializeDiagnosticReport');

  router.get('/ClaimResponse', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (_req: Request, res: Response) => {
    const claims = await canonicalStore.getAllClaims();
    const responses: any[] = [];
    for (const c of claims) { const r = await canonicalStore.getClaimResponse(c.internalId); if (r) responses.push(fhirSerializer.serializeClaimResponse(r)); }
    res.json({ resourceType: 'Bundle', type: 'searchset', total: responses.length, entry: responses.map(r => ({ fullUrl: `/fhir/ClaimResponse/${r.id}`, resource: r })) });
  });

  router.get('/Consent', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
    const patientId = getQueryString((req.query as any).patient);
    const patients = await canonicalStore.getAllPatients();
    const targetPatients = patientId ? patients.filter((p: any) => p.internalId === patientId) : patients;
    const consents = await Promise.all(targetPatients.map((p: any) => engine.consentManager.getConsent(p.internalId)));
    res.json({ resourceType: 'Bundle', type: 'searchset', total: consents.length, entry: consents.map(c => ({ fullUrl: `/fhir/Consent/consent-${c.patientId}`, resource: fhirSerializer.serializeConsent(c) })) });
  });

  return router;
}
