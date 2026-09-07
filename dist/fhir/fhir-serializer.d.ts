import { CanonicalPatient } from '../core/domain/patient.js';
import { CanonicalEncounter } from '../core/domain/encounter.js';
import { CanonicalCondition } from '../core/domain/condition.js';
import { CanonicalObservation } from '../core/domain/observation.js';
import { CanonicalCoverage, CanonicalClaim, CanonicalClaimResponse } from '../core/domain/financial.js';
import { CanonicalMedicationRequest } from '../core/domain/medication.js';
import { CanonicalImmunization } from '../core/domain/immunization.js';
import { CanonicalAllergyIntolerance } from '../core/domain/allergy-intolerance.js';
import { CanonicalDiagnosticReport } from '../core/domain/diagnostic-report.js';
import { LongitudinalRecord } from '../core/domain/longitudinal-record.js';
export declare class FhirR4Serializer {
    /**
     * Serializes a CanonicalPatient to HL7 FHIR R4 Patient with NPHIES-aligned profiles
     */
    serializePatient(patient: CanonicalPatient): Record<string, any>;
    /**
     * Serializes a CanonicalEncounter to HL7 FHIR R4 Encounter
     */
    serializeEncounter(encounter: CanonicalEncounter): Record<string, any>;
    /**
     * Serializes a CanonicalCondition to HL7 FHIR R4 Condition with multi-system coding
     */
    serializeCondition(condition: CanonicalCondition): Record<string, any>;
    /**
     * Serializes a CanonicalObservation to HL7 FHIR R4 Observation (LOINC Lab)
     */
    serializeObservation(obs: CanonicalObservation): Record<string, any>;
    /**
     * Serializes a CanonicalCoverage to NPHIES-compliant FHIR R4 Coverage
     */
    serializeCoverage(cov: CanonicalCoverage): Record<string, any>;
    /**
     * Serializes a CanonicalClaim to NPHIES-compliant FHIR R4 Claim
     */
    serializeClaim(claim: CanonicalClaim): Record<string, any>;
    /**
     * Serializes a CanonicalClaimResponse to NPHIES FHIR R4 ClaimResponse
     */
    serializeClaimResponse(cr: CanonicalClaimResponse): Record<string, any>;
    /**
     * Serializes a CanonicalMedicationRequest to HL7 FHIR R4 MedicationRequest with SFDA SDC
     */
    serializeMedicationRequest(rx: CanonicalMedicationRequest): Record<string, any>;
    /**
     * Serializes a CanonicalImmunization to HL7 FHIR R4 Immunization
     */
    serializeImmunization(imm: CanonicalImmunization): Record<string, any>;
    /**
     * Bundles all patient resources into a FHIR R4 Bundle ($everything longitudinal response)
     */
    serializeLongitudinalBundle(record: LongitudinalRecord): Record<string, any>;
    /**
     * Serializes a CanonicalAllergyIntolerance to HL7 FHIR R4 AllergyIntolerance
     */
    serializeAllergyIntolerance(allergy: CanonicalAllergyIntolerance): Record<string, any>;
    /**
     * Serializes a CanonicalDiagnosticReport to HL7 FHIR R4 DiagnosticReport
     */
    serializeDiagnosticReport(report: CanonicalDiagnosticReport): Record<string, any>;
    /**
     * Serializes a PatientConsentDirective into HL7 FHIR R4 Consent resource (Saudi PDPL compliant)
     */
    serializeConsent(directive: any): Record<string, any>;
}
