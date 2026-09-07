/**
 * @deprecated LEGACY — File-based JSON NationalHealthDB. Do not use in production. PostgreSQL/Prisma is the single source of truth.
 * Retained only for old tests (national-health-db.test.ts) until they are migrated. See src/lib/prisma.ts
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
export class NationalHealthDB {
    persistPath;
    // Collections (In-Memory Tables)
    users = new Map();
    organizations = new Map();
    roles = new Map();
    rolePermissions = new Map();
    userPermissions = new Map();
    patients = new Map();
    patientOrganizations = new Map();
    encounters = new Map();
    conditions = new Map();
    observations = new Map();
    medications = new Map();
    immunizations = new Map();
    coverages = new Map();
    claims = new Map();
    consents = new Map();
    auditLogs = [];
    dataImports = new Map();
    constructor(persistPath) {
        if (persistPath === null) {
            this.persistPath = '';
        }
        else {
            this.persistPath = persistPath || path.resolve(process.cwd(), '.data', 'national-health-db.json');
            this.loadFromDisk();
        }
    }
    saveToDisk() {
        if (!this.persistPath)
            return;
        try {
            const dir = path.dirname(this.persistPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            const snapshot = {
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
        }
        catch (err) {
            console.warn('⚠️ NationalHealthDB persistence warning:', err.message);
        }
    }
    loadFromDisk() {
        if (!this.persistPath)
            return;
        try {
            if (!fs.existsSync(this.persistPath))
                return;
            const raw = fs.readFileSync(this.persistPath, 'utf-8');
            const snapshot = JSON.parse(raw);
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
        }
        catch (err) {
            console.warn('⚠️ NationalHealthDB disk load warning:', err.message);
        }
    }
    clearMemory() {
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
    async clearAll() {
        this.clearMemory();
        this.saveToDisk();
    }
    // ==========================================
    // AUDIT LOGGING
    // ==========================================
    logAudit(userId, organizationId, entityType, entityId, action, oldValues, newValues, ipAddress) {
        const entry = {
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
    insertOrganization(org) {
        const record = {
            ...org,
            id: org.id || `ORG-${uuidv4().substring(0, 8)}`,
            createdAt: new Date().toISOString()
        };
        this.organizations.set(record.id, record);
        this.saveToDisk();
        return record;
    }
    getOrganization(id) {
        return this.organizations.get(id);
    }
    getAllOrganizations() {
        return Array.from(this.organizations.values());
    }
    // ==========================================
    // 2. ROLES & PERMISSIONS
    // ==========================================
    insertRole(role) {
        this.roles.set(role.id, role);
        this.saveToDisk();
        return role;
    }
    getRoleByCode(roleCode) {
        return Array.from(this.roles.values()).find(r => r.roleCode === roleCode);
    }
    insertRolePermission(rp) {
        const record = {
            ...rp,
            id: rp.id || uuidv4(),
            createdAt: new Date().toISOString()
        };
        this.rolePermissions.set(record.id, record);
        this.saveToDisk();
        return record;
    }
    getPermissionsForRole(roleId) {
        return Array.from(this.rolePermissions.values())
            .filter(rp => rp.roleId === roleId && rp.granted)
            .map(rp => rp.permissionCode);
    }
    // ==========================================
    // 3. USERS CRUD
    // ==========================================
    insertUser(user) {
        const now = new Date().toISOString();
        const record = {
            ...user,
            id: user.id || uuidv4(),
            createdAt: now,
            updatedAt: now
        };
        this.users.set(record.id, record);
        this.saveToDisk();
        return record;
    }
    getUser(id) {
        const u = this.users.get(id);
        return u && !u.deletedAt ? u : undefined;
    }
    getUserByUsername(username) {
        return Array.from(this.users.values()).find(u => u.username === username && !u.deletedAt);
    }
    getUsersByOrganization(organizationId) {
        return Array.from(this.users.values()).filter(u => u.organizationId === organizationId && !u.deletedAt);
    }
    // ==========================================
    // 4. PATIENTS & MULTI-ORG LINKAGE
    // ==========================================
    insertPatient(patient) {
        const now = new Date().toISOString();
        const record = {
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
    getPatient(id) {
        return this.patients.get(id);
    }
    getPatientByNationalId(nationalId) {
        return Array.from(this.patients.values()).find(p => p.nationalId === nationalId);
    }
    getPatientsByOrganization(organizationId) {
        // Return patients whose primary org is this, or who have an active PatientOrganization link
        const linkedPatientIds = new Set(Array.from(this.patientOrganizations.values())
            .filter(po => po.organizationId === organizationId && po.active)
            .map(po => po.patientId));
        return Array.from(this.patients.values()).filter(p => p.organizationId === organizationId || linkedPatientIds.has(p.id));
    }
    insertPatientOrganization(link) {
        const record = {
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
    insertEncounter(enc) {
        if (!this.patients.has(enc.patientId)) {
            throw new Error(`Referential Integrity Violation: Patient [${enc.patientId}] does not exist.`);
        }
        const record = {
            ...enc,
            id: enc.id || `enc-${uuidv4().substring(0, 8)}`,
            createdAt: new Date().toISOString()
        };
        this.encounters.set(record.id, record);
        // Ensure linkage exists in PatientOrganizations
        const existingLink = Array.from(this.patientOrganizations.values()).find(po => po.patientId === enc.patientId && po.organizationId === enc.organizationId && po.active);
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
    getEncounter(id) {
        return this.encounters.get(id);
    }
    getEncountersByPatient(patientId) {
        return Array.from(this.encounters.values()).filter(e => e.patientId === patientId);
    }
    getEncountersByOrganization(organizationId) {
        return Array.from(this.encounters.values()).filter(e => e.organizationId === organizationId);
    }
    // ==========================================
    // 6. CLINICAL: CONDITIONS
    // ==========================================
    insertCondition(cond) {
        if (!this.patients.has(cond.patientId)) {
            throw new Error(`Referential Integrity Violation: Patient [${cond.patientId}] does not exist.`);
        }
        const record = {
            ...cond,
            id: cond.id || `cond-${uuidv4().substring(0, 8)}`
        };
        this.conditions.set(record.id, record);
        this.saveToDisk();
        return record;
    }
    getConditionsByPatient(patientId) {
        return Array.from(this.conditions.values()).filter(c => c.patientId === patientId);
    }
    getConditionsByOrganization(organizationId) {
        return Array.from(this.conditions.values()).filter(c => c.organizationId === organizationId);
    }
    // ==========================================
    // 7. CLINICAL: OBSERVATIONS (LABS / VITALS)
    // ==========================================
    insertObservation(obs) {
        if (!this.patients.has(obs.patientId)) {
            throw new Error(`Referential Integrity Violation: Patient [${obs.patientId}] does not exist.`);
        }
        const record = {
            ...obs,
            id: obs.id || `obs-${uuidv4().substring(0, 8)}`
        };
        this.observations.set(record.id, record);
        this.saveToDisk();
        return record;
    }
    getObservationsByPatient(patientId) {
        return Array.from(this.observations.values()).filter(o => o.patientId === patientId);
    }
    getObservationsByOrganization(organizationId) {
        return Array.from(this.observations.values()).filter(o => o.organizationId === organizationId);
    }
    // ==========================================
    // 8. CLINICAL: MEDICATIONS (E-PRESCRIPTIONS)
    // ==========================================
    insertMedication(med) {
        if (!this.patients.has(med.patientId)) {
            throw new Error(`Referential Integrity Violation: Patient [${med.patientId}] does not exist.`);
        }
        const record = {
            ...med,
            id: med.id || `med-${uuidv4().substring(0, 8)}`
        };
        this.medications.set(record.id, record);
        this.saveToDisk();
        return record;
    }
    getMedicationsByPatient(patientId) {
        return Array.from(this.medications.values()).filter(m => m.patientId === patientId);
    }
    getMedicationsByOrganization(organizationId) {
        return Array.from(this.medications.values()).filter(m => m.organizationId === organizationId);
    }
    // ==========================================
    // 9. CLINICAL: IMMUNIZATIONS (VACCINES)
    // ==========================================
    insertImmunization(imm) {
        if (!this.patients.has(imm.patientId)) {
            throw new Error(`Referential Integrity Violation: Patient [${imm.patientId}] does not exist.`);
        }
        const record = {
            ...imm,
            id: imm.id || `vax-${uuidv4().substring(0, 8)}`
        };
        this.immunizations.set(record.id, record);
        this.saveToDisk();
        return record;
    }
    getImmunizationsByPatient(patientId) {
        return Array.from(this.immunizations.values()).filter(i => i.patientId === patientId);
    }
    getImmunizationsByOrganization(organizationId) {
        return Array.from(this.immunizations.values()).filter(i => i.organizationId === organizationId);
    }
    // ==========================================
    // 10. FINANCIAL: COVERAGES
    // ==========================================
    insertCoverage(cov) {
        if (!this.patients.has(cov.patientId)) {
            throw new Error(`Referential Integrity Violation: Patient [${cov.patientId}] does not exist.`);
        }
        const record = {
            ...cov,
            id: cov.id || `cov-${uuidv4().substring(0, 8)}`
        };
        this.coverages.set(record.id, record);
        this.saveToDisk();
        return record;
    }
    getCoveragesByPatient(patientId) {
        return Array.from(this.coverages.values()).filter(c => c.patientId === patientId);
    }
    // ==========================================
    // 11. FINANCIAL: CLAIMS (E-CLAIMS)
    // ==========================================
    insertClaim(claim) {
        if (!this.patients.has(claim.patientId)) {
            throw new Error(`Referential Integrity Violation: Patient [${claim.patientId}] does not exist.`);
        }
        const record = {
            ...claim,
            id: claim.id || `clm-${uuidv4().substring(0, 8)}`,
            createdAt: new Date().toISOString()
        };
        this.claims.set(record.id, record);
        this.saveToDisk();
        return record;
    }
    getClaimsByPatient(patientId) {
        return Array.from(this.claims.values()).filter(c => c.patientId === patientId);
    }
    getClaimsByOrganization(organizationId) {
        return Array.from(this.claims.values()).filter(c => c.organizationId === organizationId);
    }
    // ==========================================
    // 12. CONSENTS & PRIVACY
    // ==========================================
    insertConsent(consent) {
        if (!this.patients.has(consent.patientId)) {
            throw new Error(`Referential Integrity Violation: Patient [${consent.patientId}] does not exist.`);
        }
        const record = {
            ...consent,
            id: consent.id || uuidv4(),
            grantedAt: new Date().toISOString()
        };
        this.consents.set(record.id, record);
        this.saveToDisk();
        return record;
    }
    getConsentsByPatient(patientId) {
        return Array.from(this.consents.values()).filter(c => c.patientId === patientId);
    }
    isConsentGranted(patientId, organizationId) {
        const consent = Array.from(this.consents.values())
            .filter(c => c.patientId === patientId && c.organizationId === organizationId)
            .pop();
        if (!consent)
            return true; // Default standard opt-in unless explicitly revoked
        return consent.granted;
    }
    // ==========================================
    // 13. DATA IMPORTS
    // ==========================================
    insertDataImport(imp) {
        const record = {
            ...imp,
            id: imp.id || `imp-${uuidv4().substring(0, 8)}`,
            startedAt: new Date().toISOString()
        };
        this.dataImports.set(record.id, record);
        this.saveToDisk();
        return record;
    }
    updateDataImport(id, updates) {
        const existing = this.dataImports.get(id);
        if (!existing)
            return undefined;
        const updated = { ...existing, ...updates };
        this.dataImports.set(id, updated);
        this.saveToDisk();
        return updated;
    }
    getDataImportsByOrganization(organizationId) {
        return Array.from(this.dataImports.values()).filter(di => di.organizationId === organizationId);
    }
    // ==========================================
    // 14. AGGREGATED PATIENT LONGITUDINAL RECORD
    // ==========================================
    getPatientLongitudinalRecord(patientId) {
        const patient = this.getPatient(patientId);
        if (!patient)
            return null;
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
//# sourceMappingURL=national-health-db.js.map