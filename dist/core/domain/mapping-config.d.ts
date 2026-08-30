export type MappingStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';
export type MappingValidationState = 'UNTESTED' | 'TESTED' | 'VALIDATED';
export interface FieldMappingRule {
    sourceField: string;
    targetField: string;
    required?: boolean;
    transformation?: string;
    transformParams?: Record<string, any>;
    terminologyMapId?: string;
    defaultValue?: any;
    notes?: string;
}
export interface MappingConfiguration {
    id: string;
    sourceSystemId: string;
    sourceEntityType: string;
    targetCanonicalEntity: 'CanonicalPatient' | 'CanonicalEncounter' | 'CanonicalCondition' | 'CanonicalObservation' | 'CanonicalCoverage' | 'CanonicalClaim' | 'CanonicalMedicationRequest' | 'CanonicalImmunization' | 'CanonicalAllergyIntolerance' | 'CanonicalDiagnosticReport';
    mappingVersion: string;
    effectiveDate: string;
    status: MappingStatus;
    author: string;
    description: string;
    validationState: MappingValidationState;
    fieldMappings: FieldMappingRule[];
    previousVersion?: string;
    changelog?: string;
}
