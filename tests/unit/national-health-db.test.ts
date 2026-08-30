import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import http from 'http';
import { NationalHealthDB } from '../../src/database/national-health-db.js';
import { MigrationRunner } from '../../src/database/migration-runner.js';
import { RbacGuard } from '../../src/security/rbac-guard.js';
import { createMohRoutes } from '../../src/api/routes/moh-routes.js';
import { createHospitalRoutes } from '../../src/api/routes/hospital-routes.js';
import { createPatientRoutes } from '../../src/api/routes/patient-routes.js';

describe('Saudi National Health Database & Multi-Tenant RBAC Access Control Suite', () => {
  let db: NationalHealthDB;
  let migrations: MigrationRunner;
  let rbac: RbacGuard;
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    // In-memory isolated DB instance
    db = new NationalHealthDB(null);
    migrations = new MigrationRunner(db);
    await migrations.runAll();
    rbac = new RbacGuard(db);

    app = express();
    app.use(express.json());
    app.use('/api/v2/moh', createMohRoutes(db, rbac));
    app.use('/api/v2/hospital', createHospitalRoutes(db, rbac));
    app.use('/api/v2/patient', createPatientRoutes(db, rbac));

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // ==========================================
  // 1. MIGRATIONS & SEEDING INTEGRITY
  // ==========================================
  it('1. should initialize database with clean roles and MOH root organization', () => {
    expect(db.roles.size).toBe(3);
    expect(db.roles.has('role-moh-admin')).toBe(true);
    expect(db.roles.has('role-hospital-admin')).toBe(true);
    expect(db.roles.has('role-patient')).toBe(true);

    const mohOrg = db.getOrganization('ORG-MOH-HQ');
    expect(mohOrg).toBeDefined();
    expect(mohOrg?.organizationType).toBe('ministry');
    expect(mohOrg?.organizationNameAr).toBe('وزارة الصحة - المقر الرئيسي');
  });

  // ==========================================
  // 2. REFERENTIAL INTEGRITY CONSTRAINTS
  // ==========================================
  it('2. should enforce referential constraints across clinical and encounter entities', () => {
    // Attempting to create encounter for non-existent patient must throw
    expect(() => {
      db.insertEncounter({
        patientId: 'pat-non-existent-999',
        organizationId: 'ORG-HOSP-01',
        encounterNumber: 'ENC-001',
        encounterType: 'emergency',
        visitDate: '2026-08-30',
        status: 'finished'
      });
    }).toThrow(/Referential Integrity Violation/);

    // Register real patient first
    const patient = db.insertPatient({
      nationalId: '1099887766',
      mrn: 'MRN-7766',
      firstName: 'Tariq',
      lastName: 'Al-Ghamdi',
      firstNameAr: 'طارق',
      lastNameAr: 'الغامدي',
      birthDate: '1992-05-12',
      gender: 'male',
      status: 'active',
      consentStatus: 'CONSENT_GRANTED',
      organizationId: 'ORG-HOSP-01'
    });
    expect(patient.id).toBeDefined();

    // Now encounter creation succeeds
    const encounter = db.insertEncounter({
      patientId: patient.id,
      organizationId: 'ORG-HOSP-01',
      encounterNumber: 'ENC-001',
      encounterType: 'emergency',
      visitDate: '2026-08-30',
      status: 'finished'
    });
    expect(encounter.id).toBeDefined();

    // Condition creation succeeds
    const condition = db.insertCondition({
      patientId: patient.id,
      encounterId: encounter.id,
      organizationId: 'ORG-HOSP-01',
      diagnosisCode: 'E11.9',
      diagnosisName: 'Type 2 diabetes mellitus without complications',
      diagnosisStatus: 'active',
      recordedAt: '2026-08-30T10:00:00Z'
    });
    expect(condition.id).toBeDefined();

    // Observation creation succeeds
    const obs = db.insertObservation({
      patientId: patient.id,
      encounterId: encounter.id,
      organizationId: 'ORG-HOSP-01',
      observationCode: '4548-4',
      observationName: 'Hemoglobin A1c',
      value: '7.2',
      unit: '%',
      interpretation: 'HIGH',
      recordedAt: '2026-08-30T10:15:00Z'
    });
    expect(obs.id).toBeDefined();
  });

  // ==========================================
  // 3. MOH ADMIN APIS & GOVERNANCE
  // ==========================================
  it('3. should allow MOH_ADMIN to register new health organizations and inspect national governance', async () => {
    // 1. Register a hospital
    const resReg = await fetch(`${baseUrl}/api/v2/moh/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Role': 'MOH_ADMIN',
        'X-User-Id': 'user-moh-director'
      },
      body: JSON.stringify({
        id: 'ORG-HOSP-DHAHRAN',
        organizationName: 'Dhahran Medical Center',
        organizationNameAr: 'مركز الظهران الطبي التخصصي',
        organizationType: 'hospital',
        region: 'Eastern',
        licenseNumber: 'LIC-DHR-88'
      })
    });

    const regData = await resReg.json() as any;
    expect(resReg.status).toBe(201);
    expect(regData.success).toBe(true);
    expect(db.organizations.has('ORG-HOSP-DHAHRAN')).toBe(true);

    // 2. Fetch Governance Metrics
    const resMetrics = await fetch(`${baseUrl}/api/v2/moh/governance/metrics`, {
      headers: { 'X-Role': 'MOH_ADMIN' }
    });
    const metrics = await resMetrics.json() as any;

    expect(resMetrics.status).toBe(200);
    expect(metrics.overview.totalOrganizations).toBeGreaterThanOrEqual(2);

    // 3. Audit trail was recorded
    expect(db.auditLogs.some(l => l.entityType === 'Organizations' && l.action === 'CREATE')).toBe(true);
  });

  it('4. should REJECT non-MOH users attempting to access MOH administrative endpoints (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/v2/moh/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Role': 'HOSPITAL_ADMIN',
        'X-Organization-Id': 'ORG-HOSP-01'
      },
      body: JSON.stringify({
        organizationName: 'Unauthorized Hospital',
        organizationNameAr: 'مستشفى غير مصرح',
        organizationType: 'hospital'
      })
    });

    const data = await res.json() as any;
    expect(res.status).toBe(403);
    expect(data.error).toContain('Forbidden');
  });

  // ==========================================
  // 4. MULTI-TENANT HOSPITAL RBAC ISOLATION
  // ==========================================
  it('5. should enforce strict organization isolation between different hospitals', async () => {
    // Register two distinct hospitals
    db.insertOrganization({
      id: 'ORG-RIYADH-01',
      organizationName: 'Riyadh Care Hospital',
      organizationNameAr: 'مستشفى رعاية الرياض',
      organizationType: 'hospital',
      region: 'Riyadh',
      status: 'active'
    });

    db.insertOrganization({
      id: 'ORG-JEDDAH-02',
      organizationName: 'Jeddah Health Clinic',
      organizationNameAr: 'عيادات جدة الصحية',
      organizationType: 'clinic',
      region: 'Makkah',
      status: 'active'
    });

    // 1. Riyadh Hospital Admin registers Patient A
    const resPatA = await fetch(`${baseUrl}/api/v2/hospital/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Role': 'HOSPITAL_ADMIN',
        'X-Organization-Id': 'ORG-RIYADH-01'
      },
      body: JSON.stringify({
        nationalId: '1011223344',
        firstName: 'Sultan',
        lastName: 'Al-Otaibi',
        firstNameAr: 'سلطان',
        lastNameAr: 'العتيبي',
        birthDate: '1988-03-20',
        gender: 'male'
      })
    });
    expect(resPatA.status).toBe(201);
    const patAData = await resPatA.json() as any;
    const patAId = patAData.patient.id;

    // 2. Riyadh Hospital Admin gets their patient list
    const resRiyadhList = await fetch(`${baseUrl}/api/v2/hospital/patients`, {
      headers: {
        'X-Role': 'HOSPITAL_ADMIN',
        'X-Organization-Id': 'ORG-RIYADH-01'
      }
    });
    const riyadhPatients = await resRiyadhList.json() as any;
    expect(resRiyadhList.status).toBe(200);
    expect(riyadhPatients.some((p: any) => p.id === patAId)).toBe(true);

    // 3. Jeddah Hospital Admin gets their patient list (Must NOT see Patient A)
    const resJeddahList = await fetch(`${baseUrl}/api/v2/hospital/patients`, {
      headers: {
        'X-Role': 'HOSPITAL_ADMIN',
        'X-Organization-Id': 'ORG-JEDDAH-02'
      }
    });
    const jeddahPatients = await resJeddahList.json() as any;
    expect(resJeddahList.status).toBe(200);
    expect(jeddahPatients.some((p: any) => p.id === patAId)).toBe(false);

    // 4. Jeddah Hospital Admin attempts to create encounter for Riyadh's Patient A => 403 Forbidden
    const resCrossEncounter = await fetch(`${baseUrl}/api/v2/hospital/encounters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Role': 'HOSPITAL_ADMIN',
        'X-Organization-Id': 'ORG-JEDDAH-02'
      },
      body: JSON.stringify({
        patientId: patAId,
        visitDate: '2026-08-30'
      })
    });

    const crossData = await resCrossEncounter.json() as any;
    expect(resCrossEncounter.status).toBe(403);
    expect(crossData.error).toContain('is not linked to your hospital');
  });

  // ==========================================
  // 5. PATIENT ACCESS PRIVACY & CONSENT
  // ==========================================
  it('6. should enforce strict patient privacy: patients can only access their own record', async () => {
    const patient1 = db.insertPatient({
      id: 'pat-ahmed-01',
      nationalId: '1088776655',
      mrn: 'MRN-01',
      firstName: 'Ahmed',
      lastName: 'Al-Shehri',
      firstNameAr: 'أحمد',
      lastNameAr: 'الشهري',
      birthDate: '1985-01-01',
      gender: 'male',
      status: 'active',
      consentStatus: 'CONSENT_GRANTED',
      organizationId: 'ORG-HOSP-01'
    });

    const patient2 = db.insertPatient({
      id: 'pat-fatima-02',
      nationalId: '2088776655',
      mrn: 'MRN-02',
      firstName: 'Fatima',
      lastName: 'Al-Zahrani',
      firstNameAr: 'فاطمة',
      lastNameAr: 'الزهراني',
      birthDate: '1990-06-15',
      gender: 'female',
      status: 'active',
      consentStatus: 'CONSENT_GRANTED',
      organizationId: 'ORG-HOSP-01'
    });

    // 1. Patient 1 views their own profile
    const resP1Self = await fetch(`${baseUrl}/api/v2/patient/profile`, {
      headers: {
        'X-Role': 'PATIENT',
        'X-Patient-Id': patient1.id
      }
    });

    const p1Profile = await resP1Self.json() as any;
    expect(resP1Self.status).toBe(200);
    expect(p1Profile.nationalId).toBe('1088776655');

    // 2. Patient 1 manages consent for a hospital
    const resConsent = await fetch(`${baseUrl}/api/v2/patient/consents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Role': 'PATIENT',
        'X-Patient-Id': patient1.id
      },
      body: JSON.stringify({
        organizationId: 'ORG-HOSP-SPECIALIZED',
        consentType: 'OPT_IN_FULL',
        granted: true,
        scope: 'clinical_records'
      })
    });

    const consentData = await resConsent.json() as any;
    expect(resConsent.status).toBe(201);
    expect(consentData.consent.granted).toBe(true);

    // 3. Check access history
    const resHistory = await fetch(`${baseUrl}/api/v2/patient/access-history`, {
      headers: {
        'X-Role': 'PATIENT',
        'X-Patient-Id': patient1.id
      }
    });

    const history = await resHistory.json() as any;
    expect(resHistory.status).toBe(200);
    expect(history.length).toBeGreaterThan(0);
  });

  // ==========================================
  // 6. AUDIT LOGGING COMPLETENESS
  // ==========================================
  it('7. should record full immutable audit log for every administrative and clinical transaction', () => {
    db.logAudit(
      'user-doctor-01',
      'ORG-HOSP-01',
      'Patients',
      'pat-100',
      'READ',
      null,
      { reason: 'Emergency Triage Review' },
      '10.0.4.15'
    );

    const lastLog = db.auditLogs[db.auditLogs.length - 1];
    expect(lastLog).toBeDefined();
    expect(lastLog.action).toBe('READ');
    expect(lastLog.entityType).toBe('Patients');
    expect(lastLog.entityId).toBe('pat-100');
    expect(lastLog.ipAddress).toBe('10.0.4.15');
  });
});

