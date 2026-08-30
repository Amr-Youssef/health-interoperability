import { FhirR4Serializer } from './fhir-serializer.js';
import { PatientReportedAllergyData, PatientReportedMedicationData, PatientReportedConditionData, PatientReportedProcedureData, FamilyMemberData, PatientReportedVitalObservationData } from '../core/domain/patient-reported-health.js';
/**
 * Extension methods for FHIR serialization of patient-reported health data
 */
export declare class PatientReportedHealthFhirSerializer extends FhirR4Serializer {
    /**
     * Serialize a patient-reported allergy to FHIR AllergyIntolerance
     */
    serializePatientReportedAllergy(allergy: PatientReportedAllergyData): Record<string, any>;
    /**
     * Serialize a patient-reported medication to FHIR MedicationStatement
     */
    serializePatientReportedMedication(medication: PatientReportedMedicationData): Record<string, any>;
    /**
     * Serialize a patient-reported condition to FHIR Condition
     */
    serializePatientReportedCondition(condition: PatientReportedConditionData): Record<string, any>;
    /**
     * Serialize a patient-reported procedure to FHIR Procedure
     */
    serializePatientReportedProcedure(procedure: PatientReportedProcedureData): Record<string, any>;
    /**
     * Serialize family member history to FHIR FamilyMemberHistory
     */
    serializePatientFamilyMember(member: FamilyMemberData): Record<string, any>;
    /**
     * Serialize a patient-reported vital observation to FHIR Observation
     */
    serializePatientReportedVitalObservation(vital: PatientReportedVitalObservationData): Record<string, any>;
    private mapFamilyRelationshipToFhir;
    private getLoincCodeForObservationType;
    private getUcumCode;
}
