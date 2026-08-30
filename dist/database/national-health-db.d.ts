import { User, Organization, Role, RolePermission, UserPermission, Patient, PatientOrganization, Encounter, Condition, Observation, Medication, Immunization, Coverage, Claim, Consent, AuditLog, DataImport, AuditAction } from './schema.js';
export declare class NationalHealthDB {
    private persistPath;
    users: Map<string, User>;
    organizations: Map<string, Organization>;
    roles: Map<string, Role>;
    rolePermissions: Map<string, RolePermission>;
    userPermissions: Map<string, UserPermission>;
    patients: Map<string, Patient>;
    patientOrganizations: Map<string, PatientOrganization>;
    encounters: Map<string, Encounter>;
    conditions: Map<string, Condition>;
    observations: Map<string, Observation>;
    medications: Map<string, Medication>;
    immunizations: Map<string, Immunization>;
    coverages: Map<string, Coverage>;
    claims: Map<string, Claim>;
    consents: Map<string, Consent>;
    auditLogs: AuditLog[];
    dataImports: Map<string, DataImport>;
    constructor(persistPath?: string | null);
    saveToDisk(): void;
    loadFromDisk(): void;
    clearMemory(): void;
    clearAll(): Promise<void>;
    logAudit(userId: string, organizationId: string, entityType: string, entityId: string, action: AuditAction, oldValues?: any, newValues?: any, ipAddress?: string): AuditLog;
    insertOrganization(org: Omit<Organization, 'id' | 'createdAt'> & {
        id?: string;
    }): Organization;
    getOrganization(id: string): Organization | undefined;
    getAllOrganizations(): Organization[];
    insertRole(role: Role): Role;
    getRoleByCode(roleCode: string): Role | undefined;
    insertRolePermission(rp: Omit<RolePermission, 'id' | 'createdAt'> & {
        id?: string;
    }): RolePermission;
    getPermissionsForRole(roleId: string): string[];
    insertUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string;
    }): User;
    getUser(id: string): User | undefined;
    getUserByUsername(username: string): User | undefined;
    getUsersByOrganization(organizationId: string): User[];
    insertPatient(patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string;
    }): Patient;
    getPatient(id: string): Patient | undefined;
    getPatientByNationalId(nationalId: string): Patient | undefined;
    getPatientsByOrganization(organizationId: string): Patient[];
    insertPatientOrganization(link: Omit<PatientOrganization, 'id'> & {
        id?: string;
    }): PatientOrganization;
    insertEncounter(enc: Omit<Encounter, 'id' | 'createdAt'> & {
        id?: string;
    }): Encounter;
    getEncounter(id: string): Encounter | undefined;
    getEncountersByPatient(patientId: string): Encounter[];
    getEncountersByOrganization(organizationId: string): Encounter[];
    insertCondition(cond: Omit<Condition, 'id'> & {
        id?: string;
    }): Condition;
    getConditionsByPatient(patientId: string): Condition[];
    getConditionsByOrganization(organizationId: string): Condition[];
    insertObservation(obs: Omit<Observation, 'id'> & {
        id?: string;
    }): Observation;
    getObservationsByPatient(patientId: string): Observation[];
    getObservationsByOrganization(organizationId: string): Observation[];
    insertMedication(med: Omit<Medication, 'id'> & {
        id?: string;
    }): Medication;
    getMedicationsByPatient(patientId: string): Medication[];
    getMedicationsByOrganization(organizationId: string): Medication[];
    insertImmunization(imm: Omit<Immunization, 'id'> & {
        id?: string;
    }): Immunization;
    getImmunizationsByPatient(patientId: string): Immunization[];
    getImmunizationsByOrganization(organizationId: string): Immunization[];
    insertCoverage(cov: Omit<Coverage, 'id'> & {
        id?: string;
    }): Coverage;
    getCoveragesByPatient(patientId: string): Coverage[];
    insertClaim(claim: Omit<Claim, 'id' | 'createdAt'> & {
        id?: string;
    }): Claim;
    getClaimsByPatient(patientId: string): Claim[];
    getClaimsByOrganization(organizationId: string): Claim[];
    insertConsent(consent: Omit<Consent, 'id' | 'grantedAt'> & {
        id?: string;
    }): Consent;
    getConsentsByPatient(patientId: string): Consent[];
    isConsentGranted(patientId: string, organizationId: string): boolean;
    insertDataImport(imp: Omit<DataImport, 'id' | 'startedAt'> & {
        id?: string;
    }): DataImport;
    updateDataImport(id: string, updates: Partial<DataImport>): DataImport | undefined;
    getDataImportsByOrganization(organizationId: string): DataImport[];
    getPatientLongitudinalRecord(patientId: string): {
        patient: Patient;
        encounters: Encounter[];
        conditions: Condition[];
        observations: Observation[];
        medications: Medication[];
        immunizations: Immunization[];
        coverages: Coverage[];
        claims: Claim[];
        consents: Consent[];
    };
}
