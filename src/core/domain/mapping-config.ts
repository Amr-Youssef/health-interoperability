export type MappingStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';
export type MappingValidationState = 'UNTESTED' | 'TESTED' | 'VALIDATED';

export interface FieldMappingRule {
  sourceField: string;
  targetField: string;
  required?: boolean;
  transformation?: string; // ID of TransformRule (e.g. 'gender_normalize', 'date_normalize')
  transformParams?: Record<string, any>;
  terminologyMapId?: string; // ID of TerminologyMap (e.g. 'hospital-a-dx-to-canonical')
  defaultValue?: any;
  notes?: string;
}

export interface MappingConfiguration {
  id: string;
  sourceSystemId: string;
  sourceEntityType: string;
  targetCanonicalEntity:
    | 'CanonicalPatient'
    | 'CanonicalEncounter'
    | 'CanonicalCondition'
    | 'CanonicalObservation'
    | 'CanonicalCoverage'
    | 'CanonicalClaim'
    | 'CanonicalMedicationRequest'
    | 'CanonicalImmunization'
    | 'CanonicalAllergyIntolerance'
    | 'CanonicalDiagnosticReport';
  mappingVersion: string; // semver e.g. "1.0.0"
  effectiveDate: string; // ISO date
  status: MappingStatus;
  author: string;
  description: string;
  validationState: MappingValidationState;
  
  fieldMappings: FieldMappingRule[];
  
  previousVersion?: string;
  changelog?: string;
}
