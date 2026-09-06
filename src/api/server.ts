import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
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
import { patientReportedHealthRoutes } from './routes/patient-reported-health-routes.js';
import { appointmentsRoutes } from './routes/appointments-routes.js';
import { correctionsRoutes } from './routes/corrections-routes.js';
import { verifyToken } from '../security/auth-middleware.js';
import { requirePermission } from '../security/authorize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { prisma as prismaInstance } from '../lib/prisma.js';
import { getJwtSecret } from '../config/jwt.js';
const JWT_SECRET = getJwtSecret();

function extractTokenFromReq(req: Request): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.split(' ')[1] || null;
  const c = (req as any).cookies?.shiep_token;
  if (c) return c;
  return null;
}

async function extractAuthUser(req: Request) {
  const token = extractTokenFromReq(req);
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await prismaInstance.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true }
    });
    return user && user.is_active ? user : null;
  } catch (err) {
    return null;
  }
}

async function resolvePatientInternalId(user: any, canonicalStore: any): Promise<string | null> {
  if (!user) return null;
  if (user.patient_profile_id) {
    const p = await canonicalStore.getPatient(user.patient_profile_id);
    if (p) return p.internalId;
  }
  const byNid = await canonicalStore.findPatientByIdentifier(user.username);
  if (byNid) return byNid.internalId;
  if (user.username === 'patient') {
    const demoAhmed = await canonicalStore.findPatientByIdentifier('1088445566');
    if (demoAhmed) return demoAhmed.internalId;
    const all = await canonicalStore.getAllPatients();
    if (all.length > 0) return all[0].internalId;
  }
  return user.patient_profile_id || null;
}

export function createPlatformApp() {
  const app = express();
  app.use(cookieParser());
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        styleSrcAttr: ["'unsafe-inline'"],
        fontSrc: ["https://fonts.gstatic.com", "https://fonts.googleapis.com", "data:"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null
      }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
  }));
  const allowedOrigins = process.env.ALLOWED_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean);
  if (!allowedOrigins || allowedOrigins.length === 0) {
    if (process.env.NODE_ENV === 'production') throw new Error('ALLOWED_ORIGIN must be set in production');
    console.warn('[SECURITY] ALLOWED_ORIGIN not set - CORS will allow all origins in development only');
  }
  app.use(cors({
    origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const DISABLE_RATE_LIMIT = process.env.DISABLE_RATE_LIMIT === 'true' && process.env.NODE_ENV !== 'production';
  const authLimiter: any = DISABLE_RATE_LIMIT ? ((req: any, _res: any, next: any) => next()) : rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'محاولات كثيرة - حاول بعد 15 دقيقة' }
  });
  const loginLimiter: any = DISABLE_RATE_LIMIT ? ((req: any, _res: any, next: any) => next()) : rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'محاولات دخول كثيرة - حاول بعد 15 دقيقة' }
  });
  if (DISABLE_RATE_LIMIT) console.log('[DEV] Rate limiting disabled via DISABLE_RATE_LIMIT=true (non-production only)');

  // Initialize Core Services
  const rawStore = new PrismaRawStore();
  const canonicalStore = new PrismaCanonicalStore();
  const mpi = new PrismaMpiService();
  const terminologyService = new PrismaTerminologyService();
  const provenanceService = new PrismaProvenanceService();

  const engine = new NormalizationEngine(
    rawStore,
    canonicalStore as any,
    mpi as any,
    terminologyService as any,
    provenanceService as any
  );

  const fhirSerializer = new FhirR4Serializer();

  // Role-based API Routes (V2 Database Schema) - rate limited
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth', authRoutes);

  app.get('/api/public/organizations', async (req: Request, res: Response) => {
    try {
      const orgs = await prismaInstance.organization.findMany({ where: { status: 'ACTIVE', NOT: { organization_type: 'MOH' } }, select: { id: true, organization_name: true, organization_name_ar: true, organization_type: true, region: true, status: true }, orderBy: { organization_name_ar: 'asc' } });
      res.json(orgs);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/public/clinicians', async (req: Request, res: Response) => {
    try {
      const orgId = req.query.organization_id as string;
      if (!orgId) return res.status(400).json({ error: 'organization_id required' });
      const org = await prismaInstance.organization.findUnique({ where: { id: orgId } });
      if (!org || org.status !== 'ACTIVE') return res.status(403).json({ error: 'Organization not active' });
      const clinicians = await prismaInstance.user.findMany({ where: { organization_id: orgId, is_active: true, role: { role_code: 'CLINICIAN' } }, select: { id: true, username: true, full_name: true, email: true }, orderBy: { full_name: 'asc' } });
      res.json(clinicians);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Serve static UI - auth pages are public, app shell is protected
  const publicDir = path.join(__dirname, '../../public');
  app.use('/auth', express.static(path.join(publicDir, 'auth')));
  app.get(['/', '/index.html'], async (req: Request, res: Response, next) => {
    const user = await extractAuthUser(req);
    if (!user) return res.redirect('/auth/login.html');
    return res.sendFile(path.join(publicDir, 'index.html'));
  });
  app.use(express.static(publicDir, { index: false }));
  app.use('/api/hospital', hospitalRoutes);
  app.use('/api/moh', mohRoutes);
  app.use('/api/patient', patientRoutes);
  app.use('/api/appointments', appointmentsRoutes);
  app.use('/api/corrections', correctionsRoutes);

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

  app.post('/api/hl7v2/ingest', verifyToken as any, requirePermission('IMPORT_EXECUTE_ORG') as any, async (req: Request, res: Response) => {
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
  app.get(['/fhir/\\$export', '/fhir/Patient/\\$export'], verifyToken as any, requirePermission('EXPORT_BULK_ANONYMIZED','EXPORT_BULK_IDENTIFIED') as any, async (req: Request, res: Response) => {
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
  app.get('/fhir/Patient', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
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

  app.get('/fhir/Patient/:id', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
    const patientId = req.params.id as string;
    const user: any = await extractAuthUser(req);
    if (user?.role?.role_code === 'PATIENT') {
      const target = await resolvePatientInternalId(user, canonicalStore);
      if (target !== patientId) return res.status(403).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'forbidden', diagnostics: 'Patients can only read own record' }] });
    }
    const patient = await canonicalStore.getPatient(patientId);
    if (!patient) {
      return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Patient not found' }] });
    }
    res.json(fhirSerializer.serializePatient(patient));
  });

  // Patient $everything (Longitudinal Record in FHIR Bundle)
  app.get('/fhir/Patient/:id/\\$everything', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
    const patientId = req.params.id as string;
    const record = await canonicalStore.getLongitudinalRecord(patientId);
    if (!record) {
      return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Patient not found' }] });
    }
    const bundle = fhirSerializer.serializeLongitudinalBundle(record);
    res.json(bundle);
  });

  // Encounter Search
  app.get('/fhir/Encounter', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
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
  app.get('/fhir/Condition', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
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
  app.get('/fhir/Observation', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
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
  app.get('/fhir/Coverage', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
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
  app.get('/fhir/Claim', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
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
  app.get('/fhir/ClaimResponse', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (_req: Request, res: Response) => {
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
  app.get('/fhir/MedicationRequest', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
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
  app.get('/fhir/Immunization', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
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
  app.get('/fhir/AllergyIntolerance', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
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
  app.get('/fhir/DiagnosticReport', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
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
  app.get('/fhir/Consent', verifyToken as any, requirePermission('FHIR_READ_SELF','FHIR_READ_ORG','FHIR_READ_ALL') as any, async (req: Request, res: Response) => {
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
  app.post('/api/pipeline/run', verifyToken as any, requirePermission('ORG_MANAGE_ALL','POLICY_MANAGE') as any, async (req: Request, res: Response) => {
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
  app.get('/api/monitoring/stats', verifyToken as any, requirePermission('ANALYTICS_READ_NATIONAL','ANALYTICS_READ_ORG','AUDIT_READ_CENTRAL','AUDIT_READ_ORG') as any, async (req: Request, res: Response) => {
    const stats = await engine.getIntegrationMonitoringStats();
    res.json(stats);
  });

  // NPHIES Financial Overview & Eligibility Check
  app.get('/api/nphies/financial-summary', verifyToken as any, requirePermission('CLAIM_MANAGE_ORG','ANALYTICS_READ_NATIONAL') as any, async (req: Request, res: Response) => {
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

  app.post('/api/nphies/eligibility/:patientId', verifyToken as any, requirePermission('CLAIM_MANAGE_ORG','PATIENT_READ_ORG','PATIENT_READ_ALL') as any, async (req: Request, res: Response) => {
    const eligibility = await engine.checkPatientEligibility(req.params.patientId as string);
    if (!eligibility) {
      return res.status(404).json({ error: 'No active insurance coverage found for this patient.' });
    }
    res.json({ success: true, eligibility });
  });

  // Medications and Immunizations APIs
  app.get('/api/medications', async (req: Request, res: Response) => {
    const user = await extractAuthUser(req);
    const list = await canonicalStore.getAllMedicationRequests();
    if (user && user.role?.role_code === 'PATIENT') {
      const targetId = await resolvePatientInternalId(user, canonicalStore);
      if (targetId) {
        return res.json(list.filter(m => m.patientId === targetId));
      }
      return res.json([]);
    }
    res.json(list);
  });

  app.get('/api/immunizations', async (req: Request, res: Response) => {
    const user = await extractAuthUser(req);
    const list = await canonicalStore.getAllImmunizations();
    if (user && user.role?.role_code === 'PATIENT') {
      const targetId = await resolvePatientInternalId(user, canonicalStore);
      if (targetId) {
        return res.json(list.filter(v => v.patientId === targetId));
      }
      return res.json([]);
    }
    res.json(list);
  });

  // Dynamic Hospital Registry & Onboarding
  app.get('/api/hospitals', verifyToken as any, async (req: Request, res: Response) => {
    try {
      const orgs = await prismaInstance.organization.findMany({
        where: { organization_type: { in: ['HOSPITAL', 'CLINIC', 'LABORATORY', 'PHARMACY', 'DAY_SURGERY', 'CENTER', 'MEDICAL_CENTER', 'HOSPITAL_ADMIN'] } }
      });
      const fallback = orgs.length === 0 ? await prismaInstance.organization.findMany({ where: { NOT: { organization_type: 'MOH' } } }) : orgs;
      const hospitals = fallback.map(o => ({
        hospitalId: o.id,
        hospitalName: o.organization_name,
        hospitalNameAr: o.organization_name_ar || o.organization_name,
        organizationType: o.organization_type,
        facilityType: o.organization_type,
        region: o.region || 'غير محدد',
        status: o.status,
        createdAt: o.created_at
      }));
      res.json(hospitals);
    } catch (err) {
      console.error(err);
      res.json([]);
    }
  });

  app.post('/api/hospitals/onboard', verifyToken as any, requirePermission('ORG_MANAGE_ALL') as any, async (req: Request, res: Response) => {
    try {
      const def = req.body;
      if (!def.hospitalName || !def.hospitalNameAr) {
        return res.status(400).json({ error: 'Hospital names (Ar/En) are required.' });
      }
      const region = def.region || 'Riyadh';
      const facilityType = (def.facilityType || def.organizationType || 'HOSPITAL').toUpperCase();
      const allowedTypes = ['HOSPITAL','CLINIC','DAY_SURGERY','LABORATORY','PHARMACY','CENTER'];
      const orgType = allowedTypes.includes(facilityType) ? facilityType : 'HOSPITAL';
      const existingByName = await prismaInstance.organization.findFirst({ where: { OR: [{ organization_name: def.hospitalName }, { organization_name_ar: def.hospitalNameAr }] } });
      if (existingByName) return res.status(400).json({ error: 'اسم المنشأة مسجل مسبقاً' });
      const adminUsername = def.adminUsername?.trim();
      const adminPassword = def.adminPassword;
      const adminFullName = def.adminFullName?.trim();
      const adminEmail = def.adminEmail?.trim()?.toLowerCase();
      const adminPhoneRaw = def.adminPhone?.trim();
      if (!adminUsername || !adminPassword || !adminFullName || !adminEmail || !adminPhoneRaw) {
        return res.status(400).json({ error: 'بيانات أدمن المنشأة مطلوبة: username, password, fullName, email, phone' });
      }
      if (adminPassword.length < 8 || !/[A-Za-z]/.test(adminPassword) || !/\d/.test(adminPassword)) {
        return res.status(400).json({ error: 'كلمة مرور الأدمن ضعيفة: 8+ حروف وأرقام' });
      }
      const existingUser = await prismaInstance.user.findFirst({ where: { OR: [{ username: adminUsername }, { email: adminEmail }] } });
      if (existingUser) return res.status(400).json({ error: 'اسم المستخدم أو البريد للأدمن مسجل مسبقاً' });
      const phoneClean = adminPhoneRaw.replace(/[\s\-\(\)]/g, '');
      let phoneNorm: string | null = null;
      if (/^05\d{8}$/.test(phoneClean)) phoneNorm = '+966' + phoneClean.substring(1);
      else if (/^5\d{8}$/.test(phoneClean)) phoneNorm = '+966' + phoneClean;
      else if (/^9665\d{8}$/.test(phoneClean)) phoneNorm = '+' + phoneClean;
      else if (/^\+9665\d{8}$/.test(phoneClean)) phoneNorm = phoneClean;
      else return res.status(400).json({ error: 'رقم جوال الأدمن غير صحيح: 05xxxxxxxx أو +9665xxxxxxxx' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) return res.status(400).json({ error: 'بريد الأدمن غير صالح' });

      const hospitalAdminRole = await prismaInstance.role.findUnique({ where: { role_code: 'HOSPITAL_ADMIN' } });
      if (!hospitalAdminRole) return res.status(500).json({ error: 'HOSPITAL_ADMIN role missing' });

      const org = await prismaInstance.organization.create({
        data: {
          organization_name: def.hospitalName,
          organization_name_ar: def.hospitalNameAr,
          organization_type: orgType,
          region,
          status: 'PENDING_APPROVAL'
        }
      });
      const { default: bcrypt } = await import('bcryptjs');
      const hash = await bcrypt.hash(adminPassword, 10);
      const adminUser = await prismaInstance.user.create({
        data: {
          username: adminUsername,
          password_hash: hash,
          full_name: adminFullName,
          email: adminEmail,
          phone: phoneNorm,
          role_id: hospitalAdminRole.id,
          organization_id: org.id,
          is_active: true
        }
      });
      await prismaInstance.auditLog.create({ data: { entity_type: 'Organization', entity_id: org.id, action: 'HOSPITAL_ONBOARDED_PENDING', actor_id: (req as any).user?.id, organization_id: org.id, new_values: JSON.stringify({ hospitalName: org.organization_name, hospitalNameAr: org.organization_name_ar, region, facilityType: orgType, adminUsername, sourceSchema: def.sourceSchema || null, defaultMappingConfigs: def.defaultMappingConfigs || null }), details: `SYS_ADMIN onboarded ${org.organization_name_ar} with admin ${adminUsername} -> PENDING_APPROVAL` } }).catch(()=>{});
      await prismaInstance.auditLog.create({ data: { entity_type: 'User', entity_id: adminUser.id, action: 'HOSPITAL_ADMIN_CREATED_ONBOARD', actor_id: (req as any).user?.id, organization_id: org.id, new_values: JSON.stringify({ username: adminUsername, organizationId: org.id }), details: `Hospital admin ${adminUsername} created with facility ${org.organization_name_ar}` } }).catch(()=>{});
      res.json({ success: true, message: `تم تسجيل المنشأة [${def.hospitalNameAr}] وإنشاء حساب الأدمن [${adminUsername}] - بانتظار اعتماد MOH لتفعيل الدخول`, organization: org, admin: { id: adminUser.id, username: adminUser.username, fullName: adminUser.full_name, email: adminUser.email }, hospital: { hospitalId: org.id, hospitalName: org.organization_name, hospitalNameAr: org.organization_name_ar, facilityType: orgType, region, status: org.status, createdAt: org.created_at } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/hospitals/:id/ingest', verifyToken as any, requirePermission('IMPORT_EXECUTE_ORG') as any, async (req: Request, res: Response) => {
    try {
      const targetId = req.params.id as string;
      const org = await prismaInstance.organization.findUnique({ where: { id: targetId } });
      if (!org) return res.status(404).json({ success: false, error: 'المنشأة غير موجودة في قاعدة البيانات الحقيقية' });
      if (org.status !== 'ACTIVE') return res.status(403).json({ success: false, error: `المنشأة غير معتمدة - الحالة: ${org.status} - يجب اعتمادها من MOH أولاً` });
      const { entityType, sourceRecordId, payload } = req.body;
      if (!entityType || !sourceRecordId || !payload) return res.status(400).json({ success: false, error: 'entityType, sourceRecordId, payload مطلوبة' });
      const result = await engine.ingestDynamicPayload(targetId, entityType, sourceRecordId, payload);
      await prismaInstance.auditLog.create({ data: { entity_type: 'DataIngest', entity_id: sourceRecordId, action: 'INGEST_CUSTOM', actor_id: (req as any).user?.id, organization_id: targetId, new_values: JSON.stringify({ entityType, sourceRecordId }), details: `Custom ingest to ${org.organization_name_ar}` } }).catch(()=>{});
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/ingest/file', verifyToken as any, requirePermission('IMPORT_EXECUTE_ORG') as any, async (req: Request, res: Response) => {
    try {
      const { fileName, fileContent, sourceSystemId } = req.body;
      if (!fileName || !fileContent) {
        return res.status(400).json({ error: 'Both fileName and fileContent are required.' });
      }
      let resolvedSystemId = sourceSystemId;
      if (!resolvedSystemId || resolvedSystemId === 'file-dropzone-uploader') {
        const orgs = await prismaInstance.organization.findMany({ where: { status: 'ACTIVE', NOT: { organization_type: 'MOH' } }, take: 1, orderBy: { created_at: 'asc' } });
        resolvedSystemId = orgs[0]?.id || sourceSystemId || 'file-dropzone-uploader';
      }
      if (resolvedSystemId && resolvedSystemId !== 'file-dropzone-uploader') {
        const org = await prismaInstance.organization.findUnique({ where: { id: resolvedSystemId } });
        if (org && org.status !== 'ACTIVE') return res.status(403).json({ success: false, error: `المنشأة المصدر غير معتمدة: ${org.status}` });
      }
      const result = await engine.ingestUploadedFile(fileName, fileContent, resolvedSystemId);
      await prismaInstance.auditLog.create({ data: { entity_type: 'DataImport', entity_id: fileName, action: 'FILE_INGEST', actor_id: (req as any).user?.id, organization_id: resolvedSystemId, new_values: JSON.stringify({ fileName, format: (result as any).format }), details: `File ingest ${fileName} via ${resolvedSystemId}` } }).catch(()=>{});
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Clinical Decision Support (CDS Hooks)
  app.get('/api/cds/patient/:id/safety-alerts', verifyToken as any, requirePermission('CLINICAL_READ_ORG','CLINICAL_READ_ALL') as any, async (req: Request, res: Response) => {
    try {
      const result = await engine.cdsEngine.evaluateMedicationSafety(req.params.id as string);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/cds/evaluate-draft-prescription', verifyToken as any, requirePermission('CLINICAL_WRITE_ORG','CLINICAL_READ_ORG') as any, async (req: Request, res: Response) => {
    try {
      const draft = req.body;
      const result = await engine.cdsEngine.evaluateDraftPrescription(draft);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Patient Privacy & Emergency Break-the-Glass
  app.get('/api/security/consent/:patientId', verifyToken as any, requirePermission('CONSENT_MANAGE_SELF','CONSENT_OVERRIDE','PATIENT_READ_ORG','PATIENT_READ_ALL') as any, async (req: Request, res: Response) => {
    const consent = await engine.consentManager.getConsent(req.params.patientId as string);
    res.json(consent);
  });

  app.post('/api/security/break-glass', verifyToken as any, requirePermission('BREAK_GLASS_EXECUTE') as any, async (req: Request, res: Response) => {
    const { patientId, practitionerId, requestingOrgId, emergencyReason } = req.body;
    if (!patientId || !practitionerId || !emergencyReason) {
      return res.status(400).json({ error: 'Patient ID, Practitioner ID, and Emergency Reason are mandatory.' });
    }
    const event = await engine.consentManager.executeBreakTheGlass(patientId, practitionerId, requestingOrgId || 'HOSP-EMERGENCY', emergencyReason);
    await engine.auditChain.recordEvent('BREAK_GLASS', practitionerId, 'Patient', patientId, `Break-the-Glass activated: ${emergencyReason}`);
    res.json({ success: true, event });
  });

  app.get('/api/security/break-glass/logs', verifyToken as any, requirePermission('AUDIT_READ_CENTRAL','AUDIT_READ_ORG') as any, async (req: Request, res: Response) => {
    res.json(await engine.consentManager.getAllBreakGlassEvents());
  });

  // Cryptographic Audit Chain (NCA Compliance)
  app.get('/api/security/audit-chain', verifyToken as any, requirePermission('AUDIT_READ_CENTRAL','AUDIT_READ_ORG') as any, async (req: Request, res: Response) => {
    res.json(await engine.auditChain.getRecentEvents(50));
  });

  app.get('/api/security/audit-chain/verify', verifyToken as any, requirePermission('AUDIT_READ_CENTRAL','AUDIT_READ_ORG') as any, async (req: Request, res: Response) => {
    const result = await engine.auditChain.verifyChainIntegrity();
    res.json(result);
  });

  // Population Health & National Clinical Analytics
  app.get('/api/analytics/population-health', verifyToken as any, requirePermission('ANALYTICS_READ_NATIONAL','ANALYTICS_READ_ORG') as any, async (req: Request, res: Response) => {
    try {
      const metrics = await engine.populationHealth.calculateMetrics();
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Weqaa (Saudi CDC) Communicable Disease Surveillance & Notification
  app.get('/api/analytics/weqaa/reportable-cases', verifyToken as any, requirePermission('ANALYTICS_READ_NATIONAL','ANALYTICS_READ_ORG') as any, async (req: Request, res: Response) => {
    try {
      const cases = await engine.weqaaSurveillance.detectReportableCases();
      res.json(cases);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/analytics/weqaa/bundle/:caseId', verifyToken as any, requirePermission('ANALYTICS_READ_NATIONAL','ANALYTICS_READ_ORG') as any, async (req: Request, res: Response) => {
    try {
      const bundle = await engine.weqaaSurveillance.generateWeqaaNotificationBundle(req.params.caseId as string);
      res.json(bundle);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/analytics/weqaa/dispatch/:caseId', verifyToken as any, requirePermission('ANALYTICS_READ_NATIONAL') as any, async (req: Request, res: Response) => {
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

  app.get('/api/raw-store', verifyToken as any, requirePermission('AUDIT_READ_CENTRAL','AUDIT_READ_ORG') as any, async (req: Request, res: Response) => {
    const records = await rawStore.getAll();
    res.json(records);
  });

  // Reprocess Raw Record
  app.post('/api/raw-store/:id/reprocess', verifyToken as any, requirePermission('ORG_MANAGE_ALL','IMPORT_EXECUTE_ORG') as any, async (req: Request, res: Response) => {
    try {
      const result = await engine.reprocessRecord(req.params.id as string, req.body.customConfig);
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // MPI Master Identities
  app.get('/api/mpi/identities', verifyToken as any, requirePermission('PATIENT_READ_ALL','PATIENT_READ_ORG','AUDIT_READ_CENTRAL') as any, async (req: Request, res: Response) => {
    const identities = await mpi.getAllIdentities();
    res.json(identities);
  });

  // MPI Duplicate Candidates Detection
  app.get('/api/mpi/duplicate-candidates', verifyToken as any, requirePermission('PATIENT_READ_ALL','PATIENT_READ_ORG') as any, async (req: Request, res: Response) => {
    try {
      const candidates = await mpi.findDuplicateCandidates();
      res.json(candidates);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  // MPI Identity Merge Endpoint
  app.post('/api/mpi/merge', verifyToken as any, requirePermission('PATIENT_READ_ALL','ORG_MANAGE_ALL') as any, async (req: Request, res: Response) => {
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
  app.post('/api/mpi/unmerge', verifyToken as any, requirePermission('PATIENT_READ_ALL','ORG_MANAGE_ALL') as any, async (req: Request, res: Response) => {
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
  app.get('/api/terminology/concepts', verifyToken as any, async (req: Request, res: Response) => {
    const concepts = await terminologyService.getAllConcepts();
    res.json(concepts);
  });

  // Mapping Configurations
  app.get('/api/mappings', verifyToken as any, async (req: Request, res: Response) => {
    const configs = engine.mappingEngine.getAllConfigurations();
    res.json(configs);
  });

  // Provenance Lineage Records
  app.get('/api/provenance', verifyToken as any, async (req: Request, res: Response) => {
    const records = await provenanceService.getAllProvenance();
    res.json(records);
  });

  // Scalable patient search for millions (debounced, paginated, indexed)
  app.get('/api/patients/search', async (req: Request, res: Response) => {
    const user = await extractAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role?.role_code === 'PATIENT') {
      const targetId = await resolvePatientInternalId(user, canonicalStore);
      if (targetId) {
        const p = await canonicalStore.getPatient(targetId) || await canonicalStore.findPatientByIdentifier(targetId);
        return res.json({ items: p ? [p] : [], total: p ? 1 : 0, page: 1, pageSize: 1 });
      }
      return res.json({ items: [], total: 0, page: 1, pageSize: 1 });
    }
    const q = String(req.query.q || '').trim();
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 5), 50);
    const sort = String(req.query.sort || 'recent');
    const skip = (page - 1) * limit;
    try {
      const { items, total } = await (canonicalStore as any).searchPatients({ q, skip, take: limit, sort });
      res.setHeader('Cache-Control', 'no-cache');
      res.json({ items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit), query: q });
    } catch (err: any) {
      res.status(500).json({ error: 'Search failed', details: err.message });
    }
  });

  // Canonical Patients List (for global patient context bar) - kept paginated for backwards compatibility
  app.get('/api/patients', async (req: Request, res: Response) => {
    const user = await extractAuthUser(req);
    if (user && user.role?.role_code === 'PATIENT') {
      const targetId = await resolvePatientInternalId(user, canonicalStore);
      if (targetId) {
        const p = await canonicalStore.getPatient(targetId) || await canonicalStore.findPatientByIdentifier(targetId);
        if (p) return res.json([p]);
      }
      return res.json([]);
    }
    if (req.query.q || req.query.page || req.query.limit) {
      const q = String(req.query.q || '').trim();
      const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 5), 50);
      const skip = (page - 1) * limit;
      const { items, total } = await (canonicalStore as any).searchPatients({ q, skip, take: limit, sort: String(req.query.sort || 'recent') });
      return res.json({ items, total, page, pageSize: limit });
    }
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 100);
    const { items } = await (canonicalStore as any).searchPatients({ q: '', skip: 0, take: limit, sort: 'recent' });
    res.json(items);
  });

  // Canonical Longitudinal Record
  app.get('/api/patients/:id/longitudinal', async (req: Request, res: Response) => {
    const user = await extractAuthUser(req);
    const requestedId = req.params.id as string;
    if (user && user.role?.role_code === 'PATIENT') {
      const targetId = await resolvePatientInternalId(user, canonicalStore);
      let allowed = false;
      if (targetId) {
        const targetPatient = await canonicalStore.getPatient(targetId);
        if (targetId === requestedId || 
            (targetPatient && (targetPatient.internalId === requestedId || targetPatient.identifiers?.some(i => i.value === requestedId)))) {
          allowed = true;
        }
      }
      if (!allowed) {
        return res.status(403).json({ error: 'Access denied: You can only view your own longitudinal health record.' });
      }
    }
    if (user && ['HOSPITAL_ADMIN','CLINICIAN'].includes(user.role?.role_code)) {
      const prismaCheck = prismaInstance;
      const pidCandidates = [requestedId];
      let patientInternalId: string | null = requestedId;
      try {
        const patByInternal = await prismaCheck.patient.findFirst({ where: { internal_id: requestedId } });
        if (patByInternal) { pidCandidates.push(patByInternal.internal_id, patByInternal.id); patientInternalId = patByInternal.internal_id; }
        const patById = await prismaCheck.patient.findFirst({ where: { id: requestedId } });
        if (patById) { pidCandidates.push(patById.internal_id, patById.id); patientInternalId = patById.internal_id; }
      } catch {}
      const uniquePids = [...new Set(pidCandidates)];
      const orgLink = await prismaCheck.patientOrganization.findFirst({ where: { organization_id: user.organization_id, active: true, patient: { internal_id: { in: uniquePids } } } }).catch(()=>null);
      const directPatient = await prismaCheck.patient.findFirst({ where: { internal_id: { in: uniquePids }, source_system_id: user.organization_id } }).catch(()=>null);
      if (orgLink || directPatient) {
      } else {
        const appt = await prismaCheck.appointment.findFirst({
          where: {
            patient_id: { in: uniquePids },
            organization_id: user.organization_id,
            status: { in: ['booked','arrived','fulfilled'] }
          },
          include: { consent: true }
        });
        const hasValidConsent = appt?.consent && appt.consent.granted && !appt.consent.revoked_at && (!appt.consent.expires_at || new Date(appt.consent.expires_at) > new Date());
        if (!appt || !hasValidConsent) {
          return res.status(403).json({ error: 'لا يوجد موعد/إذن نشط ولا ارتباط منشأة لهذا المريض - احجز موعد (المواعيد والكشف) وانتظر تأكيد المنشأة، أو استخدم كسر الزجاج للطوارئ. المرضى المرتبطون سابقاً (PatientOrganization) يبقون متاحين.' });
        }
        if (user.role?.role_code === 'CLINICIAN' && appt.clinician_id && appt.clinician_id !== user.id) {
          return res.status(403).json({ error: 'الموعد مرتبط بطبيب آخر - فقط الطبيب المتابع يملك صلاحية القراءة' });
        }
      }
    }
    const record = await canonicalStore.getLongitudinalRecord(requestedId);
    if (!record) return res.status(404).json({ error: 'Patient not found' });
    res.json(record);
  });
  app.use('/api/patients', patientReportedHealthRoutes);

  // Admin Data Reset (Clean-slate reset) - SYS_ADMIN only
  app.post('/api/admin/reset-data', async (req: Request, res: Response) => {
    const { verifyToken: vt, requireSysAdmin } = await import('../security/auth-middleware.js');
    let authorized = false;
    await new Promise<void>((resolve) => {
      (vt as any)(req, res, () => {
        (requireSysAdmin as any)(req, res, () => { authorized = true; resolve(); });
      });
    });
    if (!authorized) return;
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
