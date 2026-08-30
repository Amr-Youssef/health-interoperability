import { ValidationResult } from '../core/domain/types.js';
import { MappedEntityResult } from '../mapping/engine/mapping-engine.js';
export declare class DataQualityEngine {
    readonly ruleVersion = "1.0.0";
    /**
     * Validates a mapped entity before it can be admitted to the Canonical Persistence Store
     */
    validate(mapped: MappedEntityResult): Promise<ValidationResult>;
    private validatePatient;
    private validateEncounter;
    private validateCondition;
    private validateObservation;
    private validateCoverage;
    private validateClaim;
    private validateMedicationRequest;
    private validateImmunization;
    private validateAllergyIntolerance;
    private validateDiagnosticReport;
}
