/**
 * Saudi National Health Platform - Unified Database Schema
 * Production Relational Schema Definitions across 17 Canonical Entities
 */
export type OrganizationType = 'ministry' | 'hospital' | 'medical_center' | 'day_surgery' | 'clinic' | 'laboratory' | 'pharmacy';
export type OrganizationStatus = 'active' | 'suspended' | 'pending_approval';
export type SystemRoleCode = 'MOH_ADMIN' | 'HOSPITAL_ADMIN' | 'PATIENT';
export type GenderType = 'male' | 'female' | 'other' | 'unknown';
export type PatientStatus = 'active' | 'inactive' | 'deceased';
export type ConsentStatusType = 'CONSENT_GRANTED' | 'CONSENT_DENIED' | 'CONSENT_PARTIAL' | 'CONSENT_EXPLICIT_REQUIRED';
export type EncounterType = 'emergency' | 'inpatient' | 'outpatient' | 'ambulatory' | 'virtual' | 'day_surgery';
export type EncounterStatus = 'planned' | 'in-progress' | 'finished' | 'cancelled';
export type DiagnosisStatus = 'active' | 'recurrence' | 'relapse' | 'remission' | 'resolved';
export type ClaimStatus = 'submitted' | 'adjudicated' | 'approved' | 'rejected' | 'settled';
export type ImportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED';
export type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'BREAK_GLASS' | 'LOGIN' | 'CONSENT_CHANGE';
export interface User {
    id: string;
    username: string;
    email: string;
    phone?: string;
    passwordHash: string;
    fullName: string;
    fullNameAr?: string;
    roleId: string;
    roleCode: SystemRoleCode;
    organizationId: string;
    patientProfileId?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
}
export interface Organization {
    id: string;
    organizationName: string;
    organizationNameAr: string;
    organizationType: OrganizationType;
    region: string;
    status: OrganizationStatus;
    licenseNumber?: string;
    parentOrganizationId?: string | null;
    createdAt: string;
}
export interface Role {
    id: string;
    roleName: string;
    roleCode: SystemRoleCode;
    description: string;
    isSystemRole: boolean;
}
export interface RolePermission {
    id: string;
    roleId: string;
    permissionCode: string;
    granted: boolean;
    createdAt: string;
}
export interface UserPermission {
    id: string;
    userId: string;
    permissionCode: string;
    granted: boolean;
    createdAt: string;
}
export interface Patient {
    id: string;
    nationalId: string;
    mrn: string;
    firstName: string;
    lastName: string;
    firstNameAr: string;
    lastNameAr: string;
    birthDate: string;
    gender: GenderType;
    phone?: string;
    email?: string;
    status: PatientStatus;
    consentStatus: ConsentStatusType;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
}
export interface PatientOrganization {
    id: string;
    patientId: string;
    organizationId: string;
    relationshipType: 'registered' | 'admitted' | 'referred' | 'emergency';
    assignedAt: string;
    active: boolean;
}
export interface Encounter {
    id: string;
    patientId: string;
    organizationId: string;
    encounterNumber: string;
    encounterType: EncounterType;
    visitDate: string;
    dischargeDate?: string;
    reasonCode?: string;
    reasonDescription?: string;
    status: EncounterStatus;
    createdAt: string;
}
export interface Condition {
    id: string;
    patientId: string;
    encounterId: string;
    organizationId: string;
    diagnosisCode: string;
    diagnosisName: string;
    diagnosisStatus: DiagnosisStatus;
    recordedAt: string;
}
export interface Observation {
    id: string;
    patientId: string;
    encounterId: string;
    organizationId: string;
    observationCode: string;
    observationName: string;
    value: string;
    unit: string;
    referenceRange?: string;
    interpretation?: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL';
    recordedAt: string;
}
export interface Medication {
    id: string;
    patientId: string;
    encounterId: string;
    organizationId: string;
    medicationCode: string;
    medicationName: string;
    dosage: string;
    frequency: string;
    duration?: string;
    prescribedAt: string;
}
export interface Immunization {
    id: string;
    patientId: string;
    organizationId: string;
    vaccineCode: string;
    vaccineName: string;
    doseNumber?: number;
    lotNumber?: string;
    administeredAt: string;
}
export interface Coverage {
    id: string;
    patientId: string;
    organizationId: string;
    insurerName: string;
    policyNumber: string;
    coverageType: 'compulsory_private' | 'government_public' | 'self_pay';
    beneficiaryCategory?: 'CLASS_A' | 'CLASS_B' | 'VIP' | 'GOV_STANDARD';
    status: 'active' | 'cancelled' | 'expired';
}
export interface Claim {
    id: string;
    patientId: string;
    organizationId: string;
    claimNumber: string;
    totalAmount: number;
    copayAmount?: number;
    payableAmount?: number;
    status: ClaimStatus;
    createdAt: string;
}
export interface Consent {
    id: string;
    patientId: string;
    organizationId: string;
    consentType: 'OPT_IN_FULL' | 'RESTRICT_SENSITIVE' | 'CLUSTER_ONLY' | 'EXPLICIT_PER_ENCOUNTER';
    granted: boolean;
    grantedAt: string;
    revokedAt?: string | null;
    scope: string;
    consentSource: 'sehhaty_portal' | 'hospital_kiosk' | 'emergency_override';
}
export interface AuditLog {
    id: string;
    userId: string;
    organizationId: string;
    entityType: string;
    entityId: string;
    action: AuditAction;
    oldValues?: string | null;
    newValues?: string | null;
    ipAddress?: string;
    createdAt: string;
}
export interface DataImport {
    id: string;
    organizationId: string;
    sourceSystem: string;
    fileName: string;
    importType: 'hl7v2' | 'fhir_bundle' | 'csv' | 'json';
    status: ImportStatus;
    startedAt: string;
    completedAt?: string;
    recordsProcessed: number;
    recordsFailed: number;
    errorMessage?: string;
}
export interface DatabaseSnapshot {
    version: string;
    lastUpdated: string;
    users: User[];
    organizations: Organization[];
    roles: Role[];
    rolePermissions: RolePermission[];
    userPermissions: UserPermission[];
    patients: Patient[];
    patientOrganizations: PatientOrganization[];
    encounters: Encounter[];
    conditions: Condition[];
    observations: Observation[];
    medications: Medication[];
    immunizations: Immunization[];
    coverages: Coverage[];
    claims: Claim[];
    consents: Consent[];
    auditLogs: AuditLog[];
    dataImports: DataImport[];
}
