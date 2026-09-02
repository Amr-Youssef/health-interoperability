/**
 * Saudi National Health Platform - Unified Database Schema
 * Production Relational Schema Definitions across 17 Canonical Entities
 */

export type OrganizationType = 'ministry' | 'hospital' | 'medical_center' | 'day_surgery' | 'clinic' | 'laboratory' | 'pharmacy';
export type OrganizationStatus = 'active' | 'suspended' | 'pending_approval';

export type SystemRoleCode = 'SYS_ADMIN' | 'MOH_ADMIN' | 'MOH_AUDITOR' | 'HOSPITAL_ADMIN' | 'CLINICIAN' | 'PATIENT';
export const ALL_ROLES: SystemRoleCode[] = ['SYS_ADMIN','MOH_ADMIN','MOH_AUDITOR','HOSPITAL_ADMIN','CLINICIAN','PATIENT'];
export type PermissionCode = 'ORG_MANAGE_ALL'|'ORG_APPROVE'|'POLICY_MANAGE'|'QUALITY_MONITOR'|'AUDIT_READ_CENTRAL'|'AUDIT_READ_ORG'|'ANALYTICS_READ_NATIONAL'|'ANALYTICS_READ_ORG'|'USER_MANAGE_NATIONAL'|'USER_MANAGE_ORG'|'ROLE_ASSIGN_NATIONAL'|'ROLE_ASSIGN_ORG'|'PATIENT_READ_SELF'|'PATIENT_READ_ORG'|'PATIENT_READ_ALL'|'PATIENT_MANAGE_ORG'|'ENCOUNTER_CREATE_ORG'|'CLINICAL_WRITE_ORG'|'CLINICAL_READ_ORG'|'CLINICAL_READ_ALL'|'CLAIM_MANAGE_ORG'|'IMPORT_EXECUTE_ORG'|'CONSENT_MANAGE_SELF'|'CONSENT_OVERRIDE'|'BREAK_GLASS_EXECUTE'|'EXPORT_BULK_ANONYMIZED'|'EXPORT_BULK_IDENTIFIED'|'FHIR_READ_SELF'|'FHIR_READ_ORG'|'FHIR_READ_ALL'|'ACCESS_HISTORY_READ_SELF';

export type GenderType = 'male' | 'female' | 'other' | 'unknown';
export type PatientStatus = 'active' | 'inactive' | 'deceased';
export type ConsentStatusType = 'CONSENT_GRANTED' | 'CONSENT_DENIED' | 'CONSENT_PARTIAL' | 'CONSENT_EXPLICIT_REQUIRED';

export type EncounterType = 'emergency' | 'inpatient' | 'outpatient' | 'ambulatory' | 'virtual' | 'day_surgery';
export type EncounterStatus = 'planned' | 'in-progress' | 'finished' | 'cancelled';

export type DiagnosisStatus = 'active' | 'recurrence' | 'relapse' | 'remission' | 'resolved';
export type ClaimStatus = 'submitted' | 'adjudicated' | 'approved' | 'rejected' | 'settled';
export type ImportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED';

export type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'BREAK_GLASS' | 'LOGIN' | 'CONSENT_CHANGE';

// 1. Users Table
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
  patientProfileId?: string; // Set when roleCode === 'PATIENT'
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// 2. Organizations Table
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

// 3. Roles Table
export interface Role {
  id: string;
  roleName: string;
  roleCode: SystemRoleCode;
  description: string;
  isSystemRole: boolean;
}

// 4. RolePermissions Table
export interface RolePermission {
  id: string;
  roleId: string;
  permissionCode: string;
  granted: boolean;
  createdAt: string;
}

// 5. UserPermissions Table
export interface UserPermission {
  id: string;
  userId: string;
  permissionCode: string;
  granted: boolean;
  createdAt: string;
}

// 6. Patients Table
export interface Patient {
  id: string;
  nationalId: string; // 10-digit Saudi NID or Iqama
  mrn: string; // Medical Record Number in primary org
  firstName: string;
  lastName: string;
  firstNameAr: string;
  lastNameAr: string;
  birthDate: string; // YYYY-MM-DD
  gender: GenderType;
  phone?: string;
  email?: string;
  status: PatientStatus;
  consentStatus: ConsentStatusType;
  organizationId: string; // Registering Hospital Organization ID
  createdAt: string;
  updatedAt: string;
}

// 7. PatientOrganizations Table (Multi-Hospital Linkage)
export interface PatientOrganization {
  id: string;
  patientId: string;
  organizationId: string;
  relationshipType: 'registered' | 'admitted' | 'referred' | 'emergency';
  assignedAt: string;
  active: boolean;
}

// 8. Encounters Table
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

// 9. Conditions Table
export interface Condition {
  id: string;
  patientId: string;
  encounterId: string;
  organizationId: string;
  diagnosisCode: string; // ICD-10-AM / SNOMED CT
  diagnosisName: string;
  diagnosisStatus: DiagnosisStatus;
  recordedAt: string;
}

// 10. Observations Table
export interface Observation {
  id: string;
  patientId: string;
  encounterId: string;
  organizationId: string;
  observationCode: string; // LOINC code
  observationName: string;
  value: string;
  unit: string;
  referenceRange?: string;
  interpretation?: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL';
  recordedAt: string;
}

// 11. Medications Table
export interface Medication {
  id: string;
  patientId: string;
  encounterId: string;
  organizationId: string;
  medicationCode: string; // SFDA Saudi Drug Code / ATC
  medicationName: string;
  dosage: string;
  frequency: string;
  duration?: string;
  prescribedAt: string;
}

// 12. Immunizations Table
export interface Immunization {
  id: string;
  patientId: string;
  organizationId: string;
  vaccineCode: string; // Saudi MOH Vaccine Code / CVX
  vaccineName: string;
  doseNumber?: number;
  lotNumber?: string;
  administeredAt: string;
}

// 13. Coverages Table
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

// 14. Claims Table
export interface Claim {
  id: string;
  patientId: string;
  organizationId: string;
  claimNumber: string;
  totalAmount: number; // In SAR
  copayAmount?: number;
  payableAmount?: number;
  status: ClaimStatus;
  createdAt: string;
}

// 15. Consents Table
export interface Consent {
  id: string;
  patientId: string;
  organizationId: string; // Target organization permission is granted/revoked for
  consentType: 'OPT_IN_FULL' | 'RESTRICT_SENSITIVE' | 'CLUSTER_ONLY' | 'EXPLICIT_PER_ENCOUNTER';
  granted: boolean;
  grantedAt: string;
  revokedAt?: string | null;
  scope: string; // E.g., 'clinical_records', 'lab_results', 'financial_eclaims'
  consentSource: 'sehhaty_portal' | 'hospital_kiosk' | 'emergency_override';
}

// 16. AuditLogs Table
export interface AuditLog {
  id: string;
  userId: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  oldValues?: string | null; // JSON string
  newValues?: string | null; // JSON string
  ipAddress?: string;
  createdAt: string;
}

// 17. DataImports Table
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

// Database Snapshot Format
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

