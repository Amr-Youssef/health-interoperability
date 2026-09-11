import { ProvenanceInfo } from './types.js';

// === PATIENT PROFILE ===
export interface PatientProfileData {
  id?: string;
  patientId: string;
  preferredFirstName?: string;
  preferredLastName?: string;
  preferredLanguage?: string; // ISO 639-1
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  addressLine?: string;
  addressCity?: string;
  addressDistrict?: string;
  addressPostalCode?: string;
  source: 'PATIENT';
  verificationStatus: 'SELF_REPORTED' | 'VERIFIED';
  recordedAt: string;
  notes?: string;
}

// === PATIENT-REPORTED ALLERGY ===
export interface PatientReportedAllergyData {
  id?: string;
  patientId: string;
  allergenName: string; // Original patient-entered text
  allergenCode?: string; // Resolved terminology code
  allergenSystem?: string;
  allergenDisplay?: string;
  reactionText?: string;
  reactionSeverity?: 'MILD' | 'MODERATE' | 'SEVERE';
  onsetDate?: string;
  isMedicallyDiagnosed?: boolean;
  notes?: string;
  source: 'PATIENT';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'REFUTED';
  recordedAt: string;
}

// === PATIENT-REPORTED MEDICATION ===
export interface PatientReportedMedicationData {
  id?: string;
  patientId: string;
  medicationName: string; // Original patient-entered text
  medicationCode?: string;
  medicationSystem?: string;
  medicationDisplay?: string;
  strength?: string;
  dose?: string;
  frequency?: string;
  route?: string;
  reasonForUse?: string;
  startDate?: string;
  endDate?: string;
  currentlyTaking?: boolean;
  notes?: string;
  source: 'PATIENT';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'REFUTED';
  recordedAt: string;
}

// === PATIENT-REPORTED CONDITION ===
export interface PatientReportedConditionData {
  id?: string;
  patientId: string;
  conditionName: string; // Original patient-entered text
  conditionCode?: string;
  conditionSystem?: string;
  conditionDisplay?: string;
  diagnosisDate?: string;
  status?: 'ACTIVE' | 'RESOLVED' | 'RECURRENT';
  treatingFacility?: string;
  notes?: string;
  source: 'PATIENT';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'REFUTED';
  recordedAt: string;
}

// === PATIENT-REPORTED PROCEDURE ===
export interface PatientReportedProcedureData {
  id?: string;
  patientId: string;
  procedureName: string; // Original patient-entered text
  procedureCode?: string;
  procedureSystem?: string;
  procedureDisplay?: string;
  procedureDate?: string;
  facilityName?: string;
  notes?: string;
  source: 'PATIENT';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'REFUTED';
  recordedAt: string;
}

// === FAMILY MEMBER ===
export interface FamilyMemberData {
  id?: string;
  patientId: string;
  relativeName?: string;
  relationship: 'MOTHER' | 'FATHER' | 'SIBLING' | 'CHILD' | 'GRANDPARENT' | 'AUNT' | 'UNCLE' | 'COUSIN';
  conditionName?: string;
  conditionCode?: string;
  conditionSystem?: string;
  conditionDisplay?: string;
  onsetDate?: string;
  notes?: string;
  source: 'PATIENT';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'REFUTED';
  recordedAt: string;
}

// === PATIENT-REPORTED SOCIAL HISTORY ===
export interface PatientReportedSocialHistoryData {
  id?: string;
  patientId: string;
  smokingStatus?: 'NEVER' | 'FORMER' | 'CURRENT';
  smokingFrequency?: 'DAILY' | 'WEEKLY' | 'OCCASIONAL';
  tobaccoUse?: 'NONE' | 'CHEWING' | 'SNUFF' | 'PIPE' | 'OTHER';
  tobaccoFrequency?: string;
  physicalActivity?: 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'VIGOROUS';
  activityNotes?: string;
  occupation?: string;
  sleepHours?: number;
  sleepQuality?: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  otherRiskFactors?: string;
  source: 'PATIENT';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'REFUTED';
  recordedAt: string;
}

// === PATIENT-REPORTED VITAL OBSERVATION ===
export interface PatientReportedVitalObservationData {
  id?: string;
  patientId: string;
  observationType: 'BLOOD_PRESSURE' | 'HEART_RATE' | 'TEMPERATURE' | 'WEIGHT' | 'HEIGHT' | 'SPO2' | 'BLOOD_GLUCOSE';
  observationCode?: string;
  observationSystem?: string;
  observationDisplay?: string;
  valueQuantity?: number;
  valueUnit?: string;
  valueText?: string;
  systolic?: number; // For blood pressure
  diastolic?: number; // For blood pressure
  deviceName?: string;
  deviceManufacturer?: string;
  deviceModel?: string;
  deviceIdentifier?: string;
  measurementMethod: 'MANUAL_ENTRY' | 'DEVICE' | 'CALCULATED';
  recordedAt: string; // ISO timestamp
  measurementNotes?: string;
  source: 'PATIENT';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'REFUTED';
}

// === PATIENT UPLOADED DOCUMENT ===
export interface PatientUploadedDocumentData {
  id?: string;
  patientId: string;
  filename: string;
  fileMimetype: string;
  fileSizeBytes: number;
  documentCategory: 'MEDICAL_REPORT' | 'LAB_REPORT' | 'RADIOLOGY_REPORT' | 'PRESCRIPTION' | 'DISCHARGE_SUMMARY' | 'VACCINATION_CERT' | 'OPERATIVE_REPORT' | 'OTHER';
  documentDescription?: string;
  storageReference: string; // Storage path/reference
  processingStatus: 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'VERIFICATION_REQUIRED' | 'VERIFIED';
  extractedData?: string; // JSON
  extractionError?: string;
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';
  verificationNotes?: string;
  source: 'PATIENT';
  uploadTimestamp: string;
}

// === COMPOSITE VIEW ===
export interface PatientHealthProfile {
  profile?: PatientProfileData;
  allergies: PatientReportedAllergyData[];
  medications: PatientReportedMedicationData[];
  conditions: PatientReportedConditionData[];
  procedures: PatientReportedProcedureData[];
  familyHistory: FamilyMemberData[];
  socialHistory?: PatientReportedSocialHistoryData;
  vitalObservations: PatientReportedVitalObservationData[];
  documents: PatientUploadedDocumentData[];
}
