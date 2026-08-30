import { ClinicalCodingPurpose, MappingEquivalence } from './types.js';

export interface ConceptCoding {
  system: string;
  code: string;
  display: string;
  displayAr?: string;
  purpose?: ClinicalCodingPurpose;
  isPreferred?: boolean;
}

export interface CanonicalConcept {
  conceptId: string;
  preferredTerm: string;
  preferredTermAr: string;
  domain: 'DIAGNOSIS' | 'PROCEDURE' | 'LAB_TEST' | 'MEDICATION' | 'VACCINE' | 'ENCOUNTER_TYPE';
  codings: ConceptCoding[];
  description?: string;
}

export interface TerminologyMapping {
  mappingId: string;
  sourceSystemId: string;
  sourceCode: string;
  sourceDisplay?: string;
  canonicalConceptId: string;
  equivalence: MappingEquivalence;
  confidence: number;
  ruleVersion: string;
}

export interface ClinicalCode {
  sourceCode: string;
  sourceSystem: string;
  sourceDisplay?: string;
  canonicalConceptId?: string;
  
  // Resolved cross-walks
  snomedCode?: string;       // SNOMED CT (Clinical)
  snomedDisplay?: string;
  
  icd10amCode?: string;      // ICD-10-AM (Classification & Morbidity)
  icd10amDisplay?: string;
  
  sbsCode?: string;          // Saudi Billing System (SBS Claims)
  sbsDisplay?: string;
  
  achiCode?: string;         // ACHI (Procedures)
  achiDisplay?: string;
  
  loincCode?: string;        // LOINC (Laboratory Observation)
  loincDisplay?: string;
  
  sfdaCode?: string;         // Saudi Food & Drug Authority (SFDA SDC)
  sfdaDisplay?: string;
  
  atcCode?: string;          // Anatomical Therapeutic Chemical (ATC)
  rxnormCode?: string;       // RxNorm
  
  cvxCode?: string;          // Vaccine Administered Code (CVX)
  
  mappingEquivalence?: MappingEquivalence;
  confidence?: number;
}
