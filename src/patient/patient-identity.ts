/**
 * Patient Identity Strategy — canonical documentation (Phase 3)
 *
 * Patient.id            : UUID PK — surrogate, immutable, never exposed as national identity. Used as FK for PatientReported* + PatientIdentifier + PatientProfile + User.patient_profile_id
 * Patient.internal_id   : CURRENTLY = NID (10 digits starting 1/2) — violates sovereign opacity. Phase 6 will migrate to UUID opaque.
 *                         Clinical tables (Encounter/Condition/Observation/MedicationRequest/Immunization/Coverage/Claim/Consent/Appointment) FK → Patient.internal_id
 *                         This split is the #1 migration risk. Do not add new FKs to internal_id; new tables must use Patient.id.
 * PatientIdentifier.value : NID/IQAMA/MRN — the true national identity. Display via PatientIdentifier, never via internal_id. Phase 6 will mask NID in FHIR URLs.
 *
 * Rules:
 *  - Sovereign fields (nationalId, internalId, birthDate, gender, legal names, username, role) are READ-ONLY for PATIENT.
 *  - Only MOH_ADMIN/SYS_ADMIN via PATCH /api/moh/patients/:id/identity may correct them (audited).
 *  - Patient self-service may only touch 13 whitelisted fields (see patient.service.ts).
 *  - Do not merge source / verification_status / correction_status into one status.
 */

export const SOVEREIGN_READ_ONLY_FIELDS = [
  'nationalId','internalId','birthDate','gender','firstName','lastName','firstNameAr','lastNameAr','username','fullName','role'
] as const;

export const ALLOWED_SELF_SERVICE_FIELDS = [
  'phone','email','preferredFirstName','preferredLastName','preferredLanguage','emergencyContactName','emergencyContactPhone','emergencyContactRelationship','addressLine','addressCity','addressDistrict','addressPostalCode','notes'
] as const;
