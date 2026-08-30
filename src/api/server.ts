import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { PrismaRawStore } from '../ingestion/raw-store/prisma-raw-store.js';
import { PrismaCanonicalStore } from '../persistence/prisma-canonical-store.js';
import { PrismaMpiService } from '../mpi/prisma-mpi-service.js';
import { PrismaTerminologyService } from '../terminology/prisma-terminology-service.js';
import { PrismaProvenanceService } from '../provenance/prisma-provenance-service.js';
import { NormalizationEngine } from '../orchestration/normalization-engine.js';
import { FhirR4Serializer } from '../fhir/fhir-serializer.js';
import { startMllpServer } from '../ingestion/hl7v2/mllp-server.js';
import { authRoutes } from './routes/auth-routes.js';
import { hospitalRoutes } from './routes/hospital-routes.js';
import { mohRoutes } from './routes/moh-routes.js';
import { patientRoutes } from './routes/patient-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createPlatformApp() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Initialize Core Services
  const rawStore = new PrismaRawStore();
  const canonicalStore = new PrismaCanonicalStore();
  const mpi = new PrismaMpiService();
  const terminologyService = new PrismaTerminologyService();
  const provenanceService = new PrismaProvenanceService();

  const engine = new NormalizationEngine(
    rawStore,
    canonicalStore,
    mpi,
    terminologyService,
    provenanceService
  );

  const fhirSerializer = new FhirR4Serializer();

  // Serve static UI from public directory
  const publicDir = path.join(__dirname, '../../public');
  app.use(express.static(publicDir));

  // Role-based API Routes (V2 Database Schema)
  app.use('/api/auth', authRoutes);
  app.use('/api/hospital', hospitalRoutes);
  app.use('/api/moh', mohRoutes);
  app.use('/api/patient', patientRoutes);

  // ==========================================
  // 1. SMART ON FHIR OAUTH2 & DISCOVERY
  // ==========================================

  // SMART Configuration Discovery Endpoint
  app.get('/.well-known/smart-configuration', (req: Request, res: Response) => {
    res.json(engine.smartAuth.getSmartConfiguration());
  });

  // Helper to safely extract query string as string
  const getQueryString = (val: string | string[] | undefined): string => {
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val[0] || '';
    return '';
  };

  // OAuth2 Token Endpoint
  app.post('/oauth/token', async (req: Request, res: Response) => {
    const { client_id, grant_type, scope, patient_id } = req.body;
    const tokenResponse = await engine.smartAuth.issueToken({
      clientId: client_id || 'sehhaty-patient-portal',
      grantType: grant_type || 'authorization_code',
      scope: scope || 'launch/patient patient/*.read openid profile',
      patientId: patient_id || '1088445566'
    });
    await engine.auditChain.recordEvent('QUERY', client_id || 'sehhaty-app', 'SmartOAuthToken', tokenResponse.access_token.substring(0, 16), `Issued SMART on FHIR access token for patient [${tokenResponse.patient}]`);
    res.json(tokenResponse);
  });

  // OAuth2 Token Introspection Endpoint
  app.post('/oauth/introspect', async (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ active: false });
    const verification = await engine.smartAuth.verifyToken(token);
    res.json({
      active: verification.isValid,
      scope: verification.scope,
      client_id: verification.clientId,
      patient: verification.patientId
    });
  });

  // ==========================================
  // 2. HL7 v2.x MLLP / TCP INGESTION ENDPOINT
  // ==========================================

  app.post('/api/hl7v2/ingest', async (req: Request, res: Response) => {
    try {
      const rawHl7 = typeof req.body === 'string' ? req.body : req.body.message || req.body.rawHl7;
      if (!rawHl7) {
        return res.status(400).json({ error: 'HL7 v2 pipe-delimited message is required.' });
      }
      const result = await engine.ingestHl7v2Message(rawHl7);
      res.json({
        success: true,
        message: `HL7 v2 [${result.parsed.messageType}^${result.parsed.triggerEvent}] processed and normalized successfully.`,
        result
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 3. FHIR R4.0.1 EXCHANGE API ENDPOINTS
  // ==========================================

  // Capability Statement
  app.get('/fhir/metadata', (req: Request, res: Response) => {
    res.json({
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString(),
      publisher: 'Saudi National Health Interoperability Platform (Prototype v0.2.4)',
      kind: 'instance',
      software: {
        name: 'Saudi Interoperability Normalization Engine, NPHIES, SFDA Drug, CDS & Bulk Export Gateway',
        version: '0.2.4'
      },
      fhirVersion: '4.0.1',
      format: ['json'],
      rest: [
        {
          mode: 'server',
          resource: [
            { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'Encounter', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'Condition', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'Observation', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'Coverage', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'Claim', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'ClaimResponse', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'MedicationRequest', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'Immunization', interaction: [{ code: 'read' }, { code: 'search-type' }] }
          ],
          operation: [
            { name: 'export', definition: 'http://hl7.org/fhir/uv/bulkdata/OperationDefinition/export' }
          ]
        }
      ]
    });
  });

  // FHIR Bulk Data Export ($export)
  app.get(['/fhir/\\$export', '/fhir/Patient/\\$export'], async (req: Request, res: Response) => {
    try {
      const anonymize = getQueryString(req.query.anonymize as any) === 'true' || getQueryString(req.query.deidentify as any) === 'true';
      const typesStr = getQueryString(req.query._type as any);
      const types = typesStr ? typesStr.split(',') : undefined;

      const result = await engine.bulkExportService.exportBulkData({
        anonymize,
        resourceTypes: types
      });

      await engine.auditChain.recordEvent(
        'BULK_EXPORT',
        'FHIR_CLIENT',
        'BulkExportResult',
        `export-${Date.now()}`,
        `Exported ${result.totalResourcesExported} resources (Anonymized: ${anonymize})`
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: err.message }] });
    }
  });

  // Patient Search / Read
  app.get('/fhir/Patient', async (req: Request, res: Response) => {
    const identifier = getQueryString(req.query.identifier as any);
    let patients = await canonicalStore.getAllPatients();

    if (identifier) {
      patients = patients.filter(p => p.identifiers.some(id => id.value.includes(identifier)));
    }

    const bundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: patients.length,
      entry: patients.map(p => ({
        fullUrl: `/fhir/Patient/${p.internalId}`,
        resource: fhirSerializer.serializePatient(p)
      }))
    };
    res.json(bundle);
  });

  app.get('/fhir/Patient/:id', async (req: Request, res: Response) => {
    const patientId = req.params.id as string;
    const patient = await canonicalStore.getPatient(patientId);
    if (!patient) {
      return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Patient not found' }] });
    }
    res.json(fhirSerializer.serializePatient(patient));
  });

  // Patient $everything (Longitudinal Record in FHIR Bundle)
  app.get('/fhir/Patient/:id/\\$everything', async (req: Request, res: Response) => {
    const patientId = req.params.id as string;
    const record = await canonicalStore.getLongitudinalRecord(patientId);
    if (!record) {
      return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Patient not found' }] });
    }
    const bundle = fhirSerializer.serializeLongitudinalBundle(record);
    res.json(bundle);
  });

  // Encounter Search
  app.get('/fhir/Encounter', async (req: Request, res: Response) => {
    const patientId = getQueryString(req.query.patient as any);
    let encounters = await canonicalStore.getAllEncounters();
    if (patientId) {
      encounters = encounters.filter(e => e.patientId === patientId);
    }
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: encounters.length,
      entry: encounters.map(e => ({
        fullUrl: `/fhir/Encounter/${e.internalId}`,
        resource: fhirSerializer.serializeEncounter(e)
      }))
    });
  });

  // Condition Search
  app.get('/fhir/Condition', async (req: Request, res: Response) => {
    const patientId = getQueryString(req.query.patient as any);
    let conditions = await canonicalStore.getAllConditions();
    if (patientId) {
      conditions = conditions.filter(c => c.patientId === patientId);
    }
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: conditions.length,
      entry: conditions.map(c => ({
        fullUrl: `/fhir/Condition/${c.internalId}`,
        resource: fhirSerializer.serializeCondition(c)
      }))
    });
  });

  // Observation Search
  app.get('/fhir/Observation', async (req: Request, res: Response) => {
    const patientId = getQueryString(req.query.patient as any);
    let observations = await canonicalStore.getAllObservations();
    if (patientId) {
      observations = observations.filter(o => o.patientId === patientId);
    }
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: observations.length,
      entry: observations.map(o => ({
        fullUrl: `/fhir/Observation/${o.internalId}`,
        resource: fhirSerializer.serializeObservation(o)
      }))
    });
  });

  // Coverage Search (FHIR NPHIES)
  app.get('/fhir/Coverage', async (req: Request, res: Response) => {
    const patientId = getQueryString(req.query.patient as any);
    let coverages = await canonicalStore.getAllCoverages();
    if (patientId) {
      coverages = coverages.filter(c => c.patientId === patientId);
    }
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: coverages.length,
      entry: coverages.map(c => ({
        fullUrl: `/fhir/Coverage/${c.internalId}`,
        resource: fhirSerializer.serializeCoverage(c)
      }))
    });
  });

  // Claim Search (FHIR NPHIES)
  app.get('/fhir/Claim', async (req: Request, res: Response) => {
    const patientId = getQueryString(req.query.patient as any);
    let claims = await canonicalStore.getAllClaims();
    if (patientId) {
      claims = claims.filter(c => c.patientId === patientId);
    }
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: claims.length,
      entry: claims.map(c => ({
        fullUrl: `/fhir/Claim/${c.internalId}`,
        resource: fhirSerializer.serializeClaim(c)
      }))
    });
  });

  // ClaimResponse Search (FHIR NPHIES)
  app.get('/fhir/ClaimResponse', async (_req: Request, res: Response) => {
    const claims = await canonicalStore.getAllClaims();
    const responses: any[] = [];
    for (const c of claims) {
      const resp = await canonicalStore.getClaimResponse(c.internalId);
      if (resp) {
        responses.push(fhirSerializer.serializeClaimResponse(resp));
      }
    }
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: responses.length,
      entry: responses.map(r => ({
        fullUrl: `/fhir/ClaimResponse/${r.id}`,
        resource: r
      }))
    });
  });

  // MedicationRequest Search (FHIR SFDA SDC)
  app.get('/fhir/MedicationRequest', async (req: Request, res: Response) => {
    const patientId = getQueryString(req.query.patient as any);
    let rxList = await canonicalStore.getAllMedicationRequests();
    if (patientId) {
      rxList = rxList.filter(m => m.patientId === patientId);
    }
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: rxList.length,
      entry: rxList.map(m => ({
        fullUrl: `/fhir/MedicationRequest/${m.internalId}`,
        resource: fhirSerializer.serializeMedicationRequest(m)
      }))
    });
  });

  // Immunization Search (FHIR Saudi MOH Vaccines)
  app.get('/fhir/Immunization', async (req: Request, res: Response) => {
    const patientId = getQueryString(req.query.patient as any);
    let immList = await canonicalStore.getAllImmunizations();
    if (patientId) {
      immList = immList.filter(i => i.patientId === patientId);
    }
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: immList.length,
      entry: immList.map(i => ({
        fullUrl: `/fhir/Immunization/${i.internalId}`,
        resource: fhirSerializer.serializeImmunization(i)
      }))
    });
  });

  // AllergyIntolerance Search (FHIR R4)
  app.get('/fhir/AllergyIntolerance', async (req: Request, res: Response) => {
    const patientId = getQueryString(req.query.patient as any);
    let allergies = await canonicalStore.getAllAllergies();
    if (patientId) {
      allergies = allergies.filter(a => a.patientId === patientId);
    }
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: allergies.length,
      entry: allergies.map(a => ({
        fullUrl: `/fhir/AllergyIntolerance/${a.internalId}`,
        resource: fhirSerializer.serializeAllergyIntolerance(a)
      }))
    });
  });

  // DiagnosticReport Search (FHIR R4)
  app.get('/fhir/DiagnosticReport', async (req: Request, res: Response) => {
    const patientId = getQueryString(req.query.patient as any);
    let reports = await canonicalStore.getAllDiagnosticReports();
    if (patientId) {
      reports = reports.filter(r => r.patientId === patientId);
    }
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: reports.length,
      entry: reports.map(r => ({
        fullUrl: `/fhir/DiagnosticReport/${r.internalId}`,
        resource: fhirSerializer.serializeDiagnosticReport(r)
      }))
    });
  });

  // Consent Search (FHIR R4 - Saudi PDPL)
  app.get('/fhir/Consent', async (req: Request, res: Response) => {
    const patientId = getQueryString(req.query.patient as any);
    const patients = await canonicalStore.getAllPatients();
    const targetPatients = patientId ? patients.filter(p => p.internalId === patientId) : patients;
    const consents = await Promise.all(targetPatients.map(p => engine.consentManager.getConsent(p.internalId)));

    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: consents.length,
      entry: consents.map(c => ({
        fullUrl: `/fhir/Consent/consent-${c.patientId}`,
        resource: fhirSerializer.serializeConsent(c)
      }))
    });
  });
  // ==========================================
  // 2. PLATFORM & NORMALIZATION API ENDPOINTS
  // ==========================================

  // Execute Full Ingestion & Normalization
  app.post('/api/pipeline/run', async (req: Request, res: Response) => {
    try {
      const result = await engine.runFullIngestionPipeline();
      res.json({
        success: true,
        message: 'Pipeline executed successfully across all heterogeneous source systems.',
        data: result
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Integration Monitoring Stats
  app.get('/api/monitoring/stats', async (req: Request, res: Response) => {
    const stats = await engine.getIntegrationMonitoringStats();
    res.json(stats);
  });

  // NPHIES Financial Overview & Eligibility Check
  app.get('/api/nphies/financial-summary', async (req: Request, res: Response) => {
    const coverages = await canonicalStore.getAllCoverages();
    const claims = await canonicalStore.getAllClaims();
    const responses = [];
    for (const clm of claims) {
      const resp = await canonicalStore.getClaimResponse(clm.internalId);
      if (resp) responses.push(resp);
    }
    res.json({
      coverages,
      claims,
      claimResponses: responses
    });
  });

  app.post('/api/nphies/eligibility/:patientId', async (req: Request, res: Response) => {
    const eligibility = await engine.checkPatientEligibility(req.params.patientId as string);
    if (!eligibility) {
      return res.status(404).json({ error: 'No active insurance coverage found for this patient.' });
    }
    res.json({ success: true, eligibility });
  });

  // Medications and Immunizations APIs
  app.get('/api/medications', async (req: Request, res: Response) => {
    const list = await canonicalStore.getAllMedicationRequests();
    res.json(list);
  });

  app.get('/api/immunizations', async (req: Request, res: Response) => {
    const list = await canonicalStore.getAllImmunizations();
    res.json(list);
  });

  // Dynamic Hospital Registry & Onboarding
  app.get('/api/hospitals', async (req: Request, res: Response) => {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      const orgs = await prisma.organization.findMany({
        where: { organization_type: 'HOSPITAL' }
      });
      // Map it to what the frontend expects
      const hospitals = orgs.map(o => ({
        hospitalId: o.id,
        hospitalName: o.organization_name,
        hospitalNameAr: o.organization_name_ar || o.organization_name,
        region: o.region || 'غير محدد',
        status: o.status
      }));
      res.json(hospitals);
    } catch (err) {
      console.error(err);
      res.json([]); // fallback
    }
  });

  app.post('/api/hospitals/onboard', (req: Request, res: Response) => {
    try {
      const def = req.body;
      if (!def.hospitalId || !def.hospitalName || !def.hospitalNameAr) {
        return res.status(400).json({ error: 'Hospital ID and names are required.' });
      }
      engine.onboardHospital({
        ...def,
        createdAt: new Date().toISOString()
      });
      res.json({ success: true, message: `Hospital [${def.hospitalNameAr}] onboarded successfully.`, hospital: def });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/hospitals/:id/ingest', async (req: Request, res: Response) => {
    try {
      const { entityType, sourceRecordId, payload } = req.body;
      const result = await engine.ingestDynamicPayload(req.params.id as string, entityType, sourceRecordId, payload);
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Direct Clinical File Ingestion (HL7 v2, FHIR Bundle, CSV)
  app.post('/api/ingest/file', async (req: Request, res: Response) => {
    try {
      const { fileName, fileContent, sourceSystemId } = req.body;
      if (!fileName || !fileContent) {
        return res.status(400).json({ error: 'Both fileName and fileContent are required.' });
      }
      const result = await engine.ingestUploadedFile(fileName, fileContent, sourceSystemId || 'file-dropzone-uploader');
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Clinical Decision Support (CDS Hooks)
  app.get('/api/cds/patient/:id/safety-alerts', async (req: Request, res: Response) => {
    try {
      const result = await engine.cdsEngine.evaluateMedicationSafety(req.params.id as string);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/cds/evaluate-draft-prescription', async (req: Request, res: Response) => {
    try {
      const draft = req.body;
      const result = await engine.cdsEngine.evaluateDraftPrescription(draft);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Patient Privacy & Emergency Break-the-Glass
  app.get('/api/security/consent/:patientId', async (req: Request, res: Response) => {
    const consent = await engine.consentManager.getConsent(req.params.patientId as string);
    res.json(consent);
  });

  app.post('/api/security/break-glass', async (req: Request, res: Response) => {
    const { patientId, practitionerId, requestingOrgId, emergencyReason } = req.body;
    if (!patientId || !practitionerId || !emergencyReason) {
      return res.status(400).json({ error: 'Patient ID, Practitioner ID, and Emergency Reason are mandatory.' });
    }
    const event = await engine.consentManager.executeBreakTheGlass(patientId, practitionerId, requestingOrgId || 'HOSP-EMERGENCY', emergencyReason);
    await engine.auditChain.recordEvent('BREAK_GLASS', practitionerId, 'Patient', patientId, `Break-the-Glass activated: ${emergencyReason}`);
    res.json({ success: true, event });
  });

  app.get('/api/security/break-glass/logs', async (req: Request, res: Response) => {
    res.json(await engine.consentManager.getAllBreakGlassEvents());
  });

  // Cryptographic Audit Chain (NCA Compliance)
  app.get('/api/security/audit-chain', async (req: Request, res: Response) => {
    res.json(await engine.auditChain.getRecentEvents(50));
  });

  app.get('/api/security/audit-chain/verify', async (req: Request, res: Response) => {
    const result = await engine.auditChain.verifyChainIntegrity();
    res.json(result);
  });

  // Population Health & National Clinical Analytics
  app.get('/api/analytics/population-health', async (req: Request, res: Response) => {
    try {
      const metrics = await engine.populationHealth.calculateMetrics();
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Weqaa (Saudi CDC) Communicable Disease Surveillance & Notification
  app.get('/api/analytics/weqaa/reportable-cases', async (req: Request, res: Response) => {
    try {
      const cases = await engine.weqaaSurveillance.detectReportableCases();
      res.json(cases);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/analytics/weqaa/bundle/:caseId', async (req: Request, res: Response) => {
    try {
      const bundle = await engine.weqaaSurveillance.generateWeqaaNotificationBundle(req.params.caseId as string);
      res.json(bundle);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/analytics/weqaa/dispatch/:caseId', async (req: Request, res: Response) => {
    try {
      const result = await engine.weqaaSurveillance.dispatchCaseNotification(req.params.caseId as string);
      
      // Audit in NCA chain
      await engine.auditChain.recordEvent(
        'PUBLIC_HEALTH_NOTIFICATION' as any,
        'WEQAA_SURVEILLANCE_ROBOT',
        'WeqaaReportableCase',
        result.caseId,
        `Dispatched communicable disease notification [${result.diseaseName}] to Weqaa. Tracking: ${result.weqaaTrackingNumber}`
      );

      res.json({
        success: true,
        message: `Notification for [${result.diseaseNameAr}] dispatched to Weqaa command center successfully.`,
        case: result
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/raw-store', async (req: Request, res: Response) => {
    const records = await rawStore.getAll();
    res.json(records);
  });

  // Reprocess Raw Record
  app.post('/api/raw-store/:id/reprocess', async (req: Request, res: Response) => {
    try {
      const result = await engine.reprocessRecord(req.params.id as string, req.body.customConfig);
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // MPI Master Identities
  app.get('/api/mpi/identities', async (req: Request, res: Response) => {
    const identities = await mpi.getAllIdentities();
    res.json(identities);
  });

  // MPI Duplicate Candidates Detection
  app.get('/api/mpi/duplicate-candidates', async (req: Request, res: Response) => {
    try {
      const candidates = await mpi.findDuplicateCandidates();
      res.json(candidates);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  // MPI Identity Merge Endpoint
  app.post('/api/mpi/merge', async (req: Request, res: Response) => {
    try {
      const { survivorId, obsoleteId, reason, adminUser } = req.body;
      if (!survivorId || !obsoleteId) {
        return res.status(400).json({ error: 'Both survivorId and obsoleteId are required for identity merge.' });
      }

      const mergeResult = await mpi.mergePatientIdentities(survivorId, obsoleteId, reason || 'Clinical duplicate resolution', adminUser || 'MPI_STEWARD');
      
      // Reassign all longitudinal clinical and financial records to survivor
      const reassignResult = await canonicalStore.reassignPatientRecords(obsoleteId, survivorId);

      // Audit in NCA chain
      await engine.auditChain.recordEvent(
        'PATIENT_MERGE' as any,
        adminUser || 'MPI_STEWARD',
        'InternalPatientIdentity',
        survivorId,
        `Merged patient [${obsoleteId}] into survivor [${survivorId}]. Reassigned records: ${JSON.stringify(reassignResult)}`
      );

      res.json({
        success: true,
        message: `Successfully merged patient [${obsoleteId}] into [${survivorId}].`,
        merge: mergeResult,
        reassignedRecords: reassignResult
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // MPI Identity Unmerge Endpoint
  app.post('/api/mpi/unmerge', async (req: Request, res: Response) => {
    try {
      const { survivorId, obsoleteId, reason, adminUser } = req.body;
      if (!survivorId || !obsoleteId) {
        return res.status(400).json({ error: 'Both survivorId and obsoleteId are required for identity unmerge.' });
      }

      const unmergeResult = await mpi.unmergePatientIdentities(survivorId, obsoleteId, reason || 'Identities were incorrectly linked', adminUser || 'MPI_STEWARD');

      // Audit in NCA chain
      engine.auditChain.recordEvent(
        'PATIENT_UNMERGE' as any,
        adminUser || 'MPI_STEWARD',
        'InternalPatientIdentity',
        survivorId,
        `Unmerged patient [${obsoleteId}] from survivor [${survivorId}]. Reason: ${reason}`
      );

      res.json({
        success: true,
        message: `Successfully unmerged patient [${obsoleteId}] from [${survivorId}].`,
        unmerge: unmergeResult
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Terminology Concepts & Maps
  app.get('/api/terminology/concepts', async (req: Request, res: Response) => {
    const concepts = await terminologyService.getAllConcepts();
    res.json(concepts);
  });

  // Mapping Configurations
  app.get('/api/mappings', (req: Request, res: Response) => {
    const configs = engine.mappingEngine.getAllConfigurations();
    res.json(configs);
  });

  // Provenance Lineage Records
  app.get('/api/provenance', async (req: Request, res: Response) => {
    const records = await provenanceService.getAllProvenance();
    res.json(records);
  });

  // Canonical Patients List (for global patient context bar)
  app.get('/api/patients', async (_req: Request, res: Response) => {
    const patients = await canonicalStore.getAllPatients();
    res.json(patients);
  });

  // Canonical Longitudinal Record
  app.get('/api/patients/:id/longitudinal', async (req: Request, res: Response) => {
    const record = await canonicalStore.getLongitudinalRecord(req.params.id as string);
    if (!record) return res.status(404).json({ error: 'Patient not found' });
    res.json(record);
  });

  // Admin Data Reset (Clean-slate reset)
  app.post('/api/admin/reset-data', async (_req: Request, res: Response) => {
    try {
      await canonicalStore.clearAll();
      if (rawStore.clearAll) await rawStore.clearAll();
      await mpi.clearAll();
      engine.consentManager.clearAll();
      engine.auditChain.clearAll();
      engine.dynamicRegistry.clearAll();

      res.json({
        success: true,
        message: 'All platform records and persistent data have been reset to a clean state.'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return { app, engine, rawStore, canonicalStore, mpi, terminologyService, provenanceService };
}

// Start standalone server when executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { app, canonicalStore, engine } = createPlatformApp();
  const PORT = Number(process.env.PORT || 3000);
  const MLLP_PORT = Number(process.env.HL7_MLLP_PORT || 2575);

  await engine.boot();
  app.listen(PORT, async () => {
    console.log(`\n========================================================================`);
    console.log(`🇸🇦 Saudi National Health Interoperability Platform`);
    console.log(`🚀 Server running on: http://localhost:${PORT}`);
    console.log(`📡 FHIR R4.0.1 Endpoint: http://localhost:${PORT}/fhir/metadata`);
    console.log(`📦 FHIR Bulk Export: http://localhost:${PORT}/fhir/$export`);
    console.log(`📊 Dashboard UI: http://localhost:${PORT}`);
    console.log(`💉 HL7 v2 MLLP listener: http://localhost:${MLLP_PORT}`);
    console.log(`========================================================================\n`);

    const existingPatients = await canonicalStore.getAllPatients();
    console.log(`📂 Persistent Storage Active: ${existingPatients.length} patient(s) loaded.`);
  });

  startMllpServer({
    port: MLLP_PORT,
    onMessage: async (message: string) => {
      try {
        const result = await engine.ingestHl7v2Message(message);
        return {
          success: true,
          messageType: result.parsed.messageType,
          triggerEvent: result.parsed.triggerEvent,
          validation: result.validation
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message
        };
      }
    }
  }).then((mllpServer) => {
    console.log(`📡 HL7 MLLP server listening on port ${MLLP_PORT}`);
    (globalThis as any).__HL7_MLLP_SERVER__ = mllpServer;
  }).catch((err) => {
    console.error('❌ Failed to start HL7 MLLP server:', err.message);
  });
}
