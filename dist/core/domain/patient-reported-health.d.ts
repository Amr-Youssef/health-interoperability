export interface PatientProfileData {
    patientId: string;
    preferredFirstName?: string;
    preferredLastName?: string;
    preferredLanguage?: string;
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
export interface PatientReportedAllergyData {
    patientId: string;
    allergenName: string;
    allergenCode?: string;
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
export interface PatientReportedMedicationData {
    patientId: string;
    medicationName: string;
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
export interface PatientReportedConditionData {
    patientId: string;
    conditionName: string;
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
export interface PatientReportedProcedureData {
    patientId: string;
    procedureName: string;
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
export interface FamilyMemberData {
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
export interface PatientReportedSocialHistoryData {
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
export interface PatientReportedVitalObservationData {
    patientId: string;
    observationType: 'BLOOD_PRESSURE' | 'HEART_RATE' | 'TEMPERATURE' | 'WEIGHT' | 'HEIGHT' | 'SPO2' | 'BLOOD_GLUCOSE';
    observationCode?: string;
    observationSystem?: string;
    observationDisplay?: string;
    valueQuantity?: number;
    valueUnit?: string;
    valueText?: string;
    systolic?: number;
    diastolic?: number;
    deviceName?: string;
    deviceManufacturer?: string;
    deviceModel?: string;
    deviceIdentifier?: string;
    measurementMethod: 'MANUAL_ENTRY' | 'DEVICE' | 'CALCULATED';
    recordedAt: string;
    measurementNotes?: string;
    source: 'PATIENT';
    verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'REFUTED';
}
export interface PatientUploadedDocumentData {
    patientId: string;
    filename: string;
    fileMimetype: string;
    fileSizeBytes: number;
    documentCategory: 'MEDICAL_REPORT' | 'LAB_REPORT' | 'RADIOLOGY_REPORT' | 'PRESCRIPTION' | 'DISCHARGE_SUMMARY' | 'VACCINATION_CERT' | 'OPERATIVE_REPORT' | 'OTHER';
    documentDescription?: string;
    storageReference: string;
    processingStatus: 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'VERIFICATION_REQUIRED' | 'VERIFIED';
    extractedData?: string;
    extractionError?: string;
    verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';
    verificationNotes?: string;
    source: 'PATIENT';
    uploadTimestamp: string;
}
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
