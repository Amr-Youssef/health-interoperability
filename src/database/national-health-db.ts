import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  DatabaseSnapshot,
  User,
  Organization,
  Role,
  RolePermission,
  UserPermission,
  Patient,
  PatientOrganization,
  Encounter,
  Condition,
  Observation,
  Medication,
  Immunization,
  Coverage,
  Claim,
  Consent,
  AuditLog,
  DataImport,
  AuditAction
} from './schema.js';

export class NationalHealthDB {
  private persistPath: string;

  // Collections (In-Memory Tables)
  public users: Map<string, User> = new Map();
  public organizations: Map<string, Organization> = new Map();
  public roles: Map<string, Role> = new Map();
  public rolePermissions: Map<string, RolePermission> = new Map();
  public userPermissions: Map<string, UserPermission> = new Map();
  public patients: Map<string, Patient> = new Map();
  public patientOrganizations: Map<string, PatientOrganization> = new Map();
  public encounters: Map<string, Encounter> = new Map();
  public conditions: Map<string, Condition> = new Map();
  public observations: Map<string, Observation> = new Map();
  public medications: Map<string, Medication> = new Map();
  public immunizations: Map<string, Immunization> = new Map();
  public coverages: Map<string, Coverage> = new Map();
  public claims: Map<string, Claim> = new Map();
  public consents: Map<string, Consent> = new Map();
  public auditLogs: AuditLog[] = [];
  public dataImports: Map<string, DataImport> = new Map();

  constructor(persistPath?: string | null) {
    if (persistPath === null) {
      this.persistPath = '';
    } else {
      this.persistPath = persistPath || path.resolve(process.cwd(), '.data', 'national-health-db.json');
      this.loadFromDisk();
    }
  }

  public saveToDisk(): void {
    if (!this.persistPath) return;
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const snapshot: DatabaseSnapshot = {
        version: '2.0.0',
        lastUpdated: new Date().toISOString(),
        users: Array.from(this.users.values()),
        organizations: Array.from(this.organizations.values()),
        roles: Array.from(this.roles.values()),
        rolePermissions: Array.from(this.rolePermissions.values()),
        userPermissions: Array.from(this.userPermissions.values()),
        patients: Array.from(this.patients.values()),
        patientOrganizations: Array.from(this.patientOrganizations.values()),
        encounters: Array.from(this.encounters.values()),
        conditions: Array.from(this.conditions.values()),
        observations: Array.from(this.observations.values()),
        medications: Array.from(this.medications.values()),
        immunizations: Array.from(this.immunizations.values()),
        coverages: Array.from(this.coverages.values()),
        claims: Array.from(this.claims.values()),
        consents: Array.from(this.consents.values()),
        auditLogs: this.auditLogs,
        dataImports: Array.from(this.dataImports.values())
      };

      fs.writeFileSync(this.persistPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('⚠️ NationalHealthDB persistence warning:', err.message);
    }
  }

  public loadFromDisk(): void {
    if (!this.persistPath) return;
    try {
      if (!fs.existsSync(this.persistPath)) return;
      const raw = fs.readFileSync(this.persistPath, 'utf-8');
      const snapshot: DatabaseSnapshot = JSON.parse(raw);

      this.clearMemory();

      snapshot.users?.forEach(u => this.users.set(u.id, u));
      snapshot.organizations?.forEach(o => this.organizations.set(o.id, o));
      snapshot.roles?.forEach(r => this.roles.set(r.id, r));
      snapshot.rolePermissions?.forEach(rp => this.rolePermissions.set(rp.id, rp));
      snapshot.userPermissions?.forEach(up => this.userPermissions.set(up.id, up));
      snapshot.patients?.forEach(p => this.patients.set(p.id, p));
      snapshot.patientOrganizations?.forEach(po => this.patientOrganizations.set(po.id, po));
      snapshot.encounters?.forEach(e => this.encounters.set(e.id, e));
      snapshot.conditions?.forEach(c => this.conditions.set(c.id, c));
      snapshot.observations?.forEach(o => this.observations.set(o.id, o));
      snapshot.medications?.forEach(m => this.medications.set(m.id, m));
      snapshot.immunizations?.forEach(i => this.immunizations.set(i.id, i));
      snapshot.coverages?.forEach(cov => this.coverages.set(cov.id, cov));
      snapshot.claims?.forEach(clm => this.claims.set(clm.id, clm));
      snapshot.consents?.forEach(cs => this.consents.set(cs.id, cs));
      this.auditLogs = snapshot.auditLogs || [];
      snapshot.dataImports?.forEach(di => this.dataImports.set(di.id, di));

      console.log(`📂 NationalHealthDB: Loaded ${this.organizations.size} org(s), ${this.patients.size} patient(s), ${this.users.size} user(s).`);
    } catch (err: any) {
      console.warn('⚠️ NationalHealthDB disk load warning:', err.message);
    }
  }

  public clearMemory(): void {
    this.users.clear();
    this.organizations.clear();
    this.roles.clear();
    this.rolePermissions.clear();
    this.userPermissions.clear();
    this.patients.clear();
    this.patientOrganizations.clear();
    this.encounters.clear();
    this.conditions.clear();
    this.observations.clear();
    this.medications.clear();
    this.immunizations.clear();
    this.coverages.clear();
    this.claims.clear();
    this.consents.clear();
    this.auditLogs = [];
    this.dataImports.clear();
  }

  public async clearAll(): Promise<void> {
    this.clearMemory();
    this.saveToDisk();
  }

  // ==========================================
  // AUDIT LOGGING
  // ==========================================
  public logAudit(
    userId: string,
    organizationId: string,
    entityType: string,
    entityId: string,
    action: AuditAction,
    oldValues?: any,
    newValues?: any,
    ipAddress?: string
  ): AuditLog {
    const entry: AuditLog = {
      id: uuidv4(),
      userId,
      organizationId,
      entityType,
      entityId,
      action,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      ipAddress: ipAddress || '127.0.0.1',
      createdAt: new Date().toISOString()
    };
    this.auditLogs.push(entry);
    this.saveToDisk();
    return entry;
  }

  // ==========================================
  // 1. ORGANIZATIONS CRUD
  // ==========================================
  public insertOrganization(org: Omit<Organization, 'id' | 'createdAt'> & { id?: string }): Organization {
    const record: Organization = {
      ...org,
      id: org.id || `ORG-${uuidv4().substring(0, 8)}`,
      createdAt: new Date().toISOString()
    };
    this.organizations.set(record.id, record);
    this.saveToDisk();
    return record;
  }

  public getOrganization(id: string): Organization | undefined {
    return this.organizations.get(id);
  }

  public getAllOrganizations(): Organization[] {
    return Array.from(this.organizations.values());
  }

  // ==========================================
  // 2. ROLES & PERMISSIONS
  // ==========================================
  public insertRole(role: Role): Role {
    this.roles.set(role.id, role);
    this.saveToDisk();
    return role;
  }

  public getRoleByCode(roleCode: string): Role | undefined {
    return Array.from(this.roles.values()).find(r => r.roleCode === roleCode);
  }

  public insertRolePermission(rp: Omit<RolePermission, 'id' | 'createdAt'> & { id?: string }): RolePermission {
    const record: RolePermission = {
      ...rp,
      id: rp.id || uuidv4(),
      createdAt: new Date().toISOString()
    };
    this.rolePermissions.set(record.id, record);
    this.saveToDisk();
    return record;
  }

  public getPermissionsForRole(roleId: string): string[] {
    return Array.from(this.rolePermissions.values())
      .filter(rp => rp.roleId === roleId && rp.granted)
      .map(rp => rp.permissionCode);
  }

  // ==========================================
  // 3. USERS CRUD
  // ==========================================
  public insertUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): User {
    const now = new Date().toISOString();
    const record: User = {
      ...user,
      id: user.id || uuidv4(),
      createdAt: now,
      updatedAt: now
    };
    this.users.set(record.id, record);
    this.saveToDisk();
    return record;
  }

  public getUser(id: string): User | undefined {
    const u = this.users.get(id);
    return u && !u.deletedAt ? u : undefined;
  }

  public getUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.username === username && !u.deletedAt);
  }

  public getUsersByOrganization(organizationId: string): User[] {
    return Array.from(this.users.values()).filter(u => u.organizationId === organizationId && !u.deletedAt);
  }

  // ==========================================
  // 4. PATIENTS & MULTI-ORG LINKAGE
  // ==========================================
  public insertPatient(patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Patient {
    const now = new Date().toISOString();
    const record: Patient = {
      ...patient,
      id: patient.id || `pat-${patient.nationalId || uuidv4().substring(0, 8)}`,
      createdAt: now,
      updatedAt: now
    };
    this.patients.set(record.id, record);

    // Auto-create initial PatientOrganization link
    this.insertPatientOrganization({
      patientId: record.id,
      organizationId: record.organizationId,
      relationshipType: 'registered',
      assignedAt: now,
      active: true
    });

    this.saveToDisk();
    return record;
  }

  public getPatient(id: string): Patient | undefined {
    return this.patients.get(id);
  }

  public getPatientByNationalId(nationalId: string): Patient | undefined {
    return Array.from(this.patients.values()).find(p => p.nationalId === nationalId);
  }

  public getPatientsByOrganization(organizationId: string): Patient[] {
    // Return patients whose primary org is this, or who have an active PatientOrganization link
    const linkedPatientIds = new Set(
      Array.from(this.patientOrganizations.values())
        .filter(po => po.organizationId === organizationId && po.active)
        .map(po => po.patientId)
    );

    return Array.from(this.patients.values()).filter(
      p => p.organizationId === organizationId || linkedPatientIds.has(p.id)
    );
  }

  public insertPatientOrganization(link: Omit<PatientOrganization, 'id'> & { id?: string }): PatientOrganization {
    const record: PatientOrganization = {
      ...link,
      id: link.id || uuidv4()
    };
    this.patientOrganizations.set(record.id, record);
    this.saveToDisk();
    return record;
  }

  // ==========================================
  // 5. ENCOUNTERS
  // ==========================================
  public insertEncounter(enc: Omit<Encounter, 'id' | 'createdAt'> & { id?: string }): Encounter {
    if (!this.patients.has(enc.patientId)) {
      throw new Error(`Referential Integrity Violation: Patient [${enc.patientId}] does not exist.`);
    }
    const record: Encounter = {
      ...enc,
      id: enc.id || `enc-${uuidv4().substring(0, 8)}`,
      createdAt: new Date().toISOString()
    };
    this.encounters.set(record.id, record);

    // Ensure linkage exists in PatientOrganizations
    const existingLink = Array.from(this.patientOrganizations.values()).find(
      po => po.patientId === enc.patientId && po.organizationId === enc.organizationId && po.active
    );
    if (!existingLink) {
      this.insertPatientOrganization({
        patientId: enc.patientId,
        organizationId: enc.organizationId,
        relationshipType: 'admitted',
        assignedAt: enc.visitDate,
        active: true
      });
    }

    this.saveToDisk();
    return record;
  }

  public getEncounter(id: string): Encounter | undefined {
    return this.encounters.get(id);
  }

  public getEncountersByPatient(patientId: string): Encounter[] {
    return Array.from(this.encounters.values()).filter(e => e.patientId === patientId);
  }

  public getEncountersByOrganization(organizationId: string): Encounter[] {
    return Array.from(this.encounters.values()).filter(e => e.organizationId === organizationId);
  }

  // ==========================================
  // 6. CLINICAL: CONDITIONS
  // ==========================================
  public insertCondition(cond: Omit<Condition, 'id'> & { id?: string }): Condition {
    if (!this.patients.has(cond.patientId)) {
      throw new Error(`Referential Integrity Violation: Patient [${cond.patientId}] does not exist.`);
    }
    const record: Condition = {
      ...cond,
      id: cond.id || `cond-${uuidv4().substring(0, 8)}`
    };
    this.conditions.set(record.id, record);
    this.saveToDisk();
    return record;
  }

  public getConditionsByPatient(patientId: string): Condition[] {
    return Array.from(this.conditions.values()).filter(c => c.patientId === patientId);
  }

  public getConditionsByOrganization(organizationId: string): Condition[] {
    return Array.from(this.conditions.values()).filter(c => c.organizationId === organizationId);
  }

  // ==========================================
  // 7. CLINICAL: OBSERVATIONS (LABS / VITALS)
  // ==========================================
  public insertObservation(obs: Omit<Observation, 'id'> & { id?: string }): Observation {
    if (!this.patients.has(obs.patientId)) {
      throw new Error(`Referential Integrity Violation: Patient [${obs.patientId}] does not exist.`);
    }
    const record: Observation = {
      ...obs,
      id: obs.id || `obs-${uuidv4().substring(0, 8)}`
    };
    this.observations.set(record.id, record);
    this.saveToDisk();
    return record;
  }

  public getObservationsByPatient(patientId: string): Observation[] {
    return Array.from(this.observations.values()).filter(o => o.patientId === patientId);
  }

  public getObservationsByOrganization(organizationId: string): Observation[] {
    return Array.from(this.observations.values()).filter(o => o.organizationId === organizationId);
  }

  // ==========================================
  // 8. CLINICAL: MEDICATIONS (E-PRESCRIPTIONS)
  // ==========================================
  public insertMedication(med: Omit<Medication, 'id'> & { id?: string }): Medication {
    if (!this.patients.has(med.patientId)) {
      throw new Error(`Referential Integrity Violation: Patient [${med.patientId}] does not exist.`);
    }
    const record: Medication = {
      ...med,
      id: med.id || `med-${uuidv4().substring(0, 8)}`
    };
    this.medications.set(record.id, record);
    this.saveToDisk();
    return record;
  }

  public getMedicationsByPatient(patientId: string): Medication[] {
    return Array.from(this.medications.values()).filter(m => m.patientId === patientId);
  }

  public getMedicationsByOrganization(organizationId: string): Medication[] {
    return Array.from(this.medications.values()).filter(m => m.organizationId === organizationId);
  }

  // ==========================================
  // 9. CLINICAL: IMMUNIZATIONS (VACCINES)
  // ==========================================
  public insertImmunization(imm: Omit<Immunization, 'id'> & { id?: string }): Immunization {
    if (!this.patients.has(imm.patientId)) {
      throw new Error(`Referential Integrity Violation: Patient [${imm.patientId}] does not exist.`);
    }
    const record: Immunization = {
      ...imm,
      id: imm.id || `vax-${uuidv4().substring(0, 8)}`
    };
    this.immunizations.set(record.id, record);
    this.saveToDisk();
    return record;
  }

  public getImmunizationsByPatient(patientId: string): Immunization[] {
    return Array.from(this.immunizations.values()).filter(i => i.patientId === patientId);
  }

  public getImmunizationsByOrganization(organizationId: string): Immunization[] {
    return Array.from(this.immunizations.values()).filter(i => i.organizationId === organizationId);
  }

  // ==========================================
  // 10. FINANCIAL: COVERAGES
  // ==========================================
  public insertCoverage(cov: Omit<Coverage, 'id'> & { id?: string }): Coverage {
    if (!this.patients.has(cov.patientId)) {
      throw new Error(`Referential Integrity Violation: Patient [${cov.patientId}] does not exist.`);
    }
    const record: Coverage = {
      ...cov,
      id: cov.id || `cov-${uuidv4().substring(0, 8)}`
    };
    this.coverages.set(record.id, record);
    this.saveToDisk();
    return record;
  }

  public getCoveragesByPatient(patientId: string): Coverage[] {
    return Array.from(this.coverages.values()).filter(c => c.patientId === patientId);
  }

  // ==========================================
  // 11. FINANCIAL: CLAIMS (E-CLAIMS)
  // ==========================================
  public insertClaim(claim: Omit<Claim, 'id' | 'createdAt'> & { id?: string }): Claim {
    if (!this.patients.has(claim.patientId)) {
      throw new Error(`Referential Integrity Violation: Patient [${claim.patientId}] does not exist.`);
    }
    const record: Claim = {
      ...claim,
      id: claim.id || `clm-${uuidv4().substring(0, 8)}`,
      createdAt: new Date().toISOString()
    };
    this.claims.set(record.id, record);
    this.saveToDisk();
    return record;
  }

  public getClaimsByPatient(patientId: string): Claim[] {
    return Array.from(this.claims.values()).filter(c => c.patientId === patientId);
  }

  public getClaimsByOrganization(organizationId: string): Claim[] {
    return Array.from(this.claims.values()).filter(c => c.organizationId === organizationId);
  }

  // ==========================================
  // 12. CONSENTS & PRIVACY
  // ==========================================
  public insertConsent(consent: Omit<Consent, 'id' | 'grantedAt'> & { id?: string }): Consent {
    if (!this.patients.has(consent.patientId)) {
      throw new Error(`Referential Integrity Violation: Patient [${consent.patientId}] does not exist.`);
    }
    const record: Consent = {
      ...consent,
      id: consent.id || uuidv4(),
      grantedAt: new Date().toISOString()
    };
    this.consents.set(record.id, record);
    this.saveToDisk();
    return record;
  }

  public getConsentsByPatient(patientId: string): Consent[] {
    return Array.from(this.consents.values()).filter(c => c.patientId === patientId);
  }

  public isConsentGranted(patientId: string, organizationId: string): boolean {
    const consent = Array.from(this.consents.values())
      .filter(c => c.patientId === patientId && c.organizationId === organizationId)
      .pop();
    if (!consent) return true; // Default standard opt-in unless explicitly revoked
    return consent.granted;
  }

  // ==========================================
  // 13. DATA IMPORTS
  // ==========================================
  public insertDataImport(imp: Omit<DataImport, 'id' | 'startedAt'> & { id?: string }): DataImport {
    const record: DataImport = {
      ...imp,
      id: imp.id || `imp-${uuidv4().substring(0, 8)}`,
      startedAt: new Date().toISOString()
    };
    this.dataImports.set(record.id, record);
    this.saveToDisk();
    return record;
  }

  public updateDataImport(id: string, updates: Partial<DataImport>): DataImport | undefined {
    const existing = this.dataImports.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.dataImports.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  public getDataImportsByOrganization(organizationId: string): DataImport[] {
    return Array.from(this.dataImports.values()).filter(di => di.organizationId === organizationId);
  }

  // ==========================================
  // 14. AGGREGATED PATIENT LONGITUDINAL RECORD
  // ==========================================
  public getPatientLongitudinalRecord(patientId: string) {
    const patient = this.getPatient(patientId);
    if (!patient) return null;

    return {
      patient,
      encounters: this.getEncountersByPatient(patientId),
      conditions: this.getConditionsByPatient(patientId),
      observations: this.getObservationsByPatient(patientId),
      medications: this.getMedicationsByPatient(patientId),
      immunizations: this.getImmunizationsByPatient(patientId),
      coverages: this.getCoveragesByPatient(patientId),
      claims: this.getClaimsByPatient(patientId),
      consents: this.getConsentsByPatient(patientId)
    };
  }
}

