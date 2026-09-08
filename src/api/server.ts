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
import { createFhirRoutes } from '../modules/fhir/fhir.routes.js';
import { createPlatformRoutes } from '../modules/platform/platform.routes.js';
import { createNphiesRoutes } from '../modules/nphies/nphies.routes.js';
import { createCdsRoutes } from '../modules/cds/cds.routes.js';
import { createAnalyticsRoutes } from '../modules/analytics/analytics.routes.js';
import { createSecurityRoutes } from '../modules/security/security.routes.js';
import { createDataRoutes } from '../modules/data/data.routes.js';
import { createPatientsRoutes } from '../modules/patients/patients.routes.js';
import { createHospitalRoutes } from '../modules/hospital/hospital.routes.js';
import { createPublicRoutes } from '../modules/public/public.routes.js';
import { createHl7Routes } from '../modules/hl7/hl7.routes.js';
import { createClinicalRoutes } from '../modules/clinical/clinical.routes.js';
import { createAdminRoutes } from '../modules/admin/admin.routes.js';
import { createSmartRoutes } from '../modules/smart/smart.routes.js';
import { createClinicalWriteRoutes } from '../modules/clinical-write/clinical-write.routes.js';
import crypto from 'crypto';

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
  app.use((req, res, next) => {
    (res as any).locals = (res as any).locals || {};
    (res as any).locals.nonce = crypto.randomBytes(16).toString('base64');
    next();
  });
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${(res as any).locals.nonce}'`, "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", (req, res) => `'nonce-${(res as any).locals.nonce}'`, "'unsafe-inline'"],
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

  // Public routes (migrated to modules/public)

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
    // Serve static UI - auth pages are public, app shell is protected
  const publicDir = path.join(__dirname, '../../public');
  const staticOpts = {
    index: false as const,
    setHeaders: (res: Response, filePath: string) => {
      if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
      else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      else if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
      else if (filePath.endsWith('.json')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  };
  app.use('/auth', express.static(path.join(publicDir, 'auth'), staticOpts));
  app.get(['/', '/index.html'], async (req: Request, res: Response, next) => {
    const user = await extractAuthUser(req);
    if (!user) return res.redirect('/auth/login.html');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.sendFile(path.join(publicDir, 'index.html'));
  });
  app.use(express.static(publicDir, staticOpts));
  app.use('/api/hospital', hospitalRoutes);
  app.use('/api/moh', mohRoutes);
  app.use('/api/patient', patientRoutes);
  app.use('/api/appointments', appointmentsRoutes);
  app.use('/api/corrections', correctionsRoutes);

  // ==========================================
  // 1. SMART ON FHIR OAUTH2 & DISCOVERY
  // ==========================================

  // SMART (migrated to modules/smart)

    app.use('/fhir', createFhirRoutes(canonicalStore as any, fhirSerializer as any, engine));
  app.use('/api', createPlatformRoutes(engine));
  app.use('/api', createNphiesRoutes(canonicalStore as any, engine));
  app.use('/api', createCdsRoutes(engine));
  app.use('/api', createAnalyticsRoutes(engine));
  app.use('/api', createSecurityRoutes(engine));
  app.use('/api', createDataRoutes(rawStore, mpi, terminologyService, provenanceService, engine, canonicalStore));
  app.use('/api', createPatientsRoutes(canonicalStore as any));
  app.use('/api', createHospitalRoutes(engine));
  app.use('/api', createPublicRoutes());
  app.use('/api', createHl7Routes(engine));
  app.use('/api', createClinicalRoutes(canonicalStore as any));
  app.use('/api/clinical', createClinicalWriteRoutes(canonicalStore as any));
  app.use('/api', createAdminRoutes(canonicalStore, rawStore, mpi, engine));
  app.use('/', createSmartRoutes(engine));

  // ==========================================
  // 2. PLATFORM & NORMALIZATION API ENDPOINTS
  // ==========================================

  // NPHIES Financial Overview & Eligibility Check (migrated to modules/nphies)

  // Clinical (migrated to modules/clinical)

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

  // Clinical Decision Support (migrated to modules/cds)

  // Security & Analytics (migrated to modules/security & modules/analytics)

    // Data layer (migrated to modules/data)

    // Patients (migrated to modules/patients)

    app.use('/api/patients', patientReportedHealthRoutes);

  // Admin (migrated to modules/admin)

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
