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
    snomedCode?: string;
    snomedDisplay?: string;
    icd10amCode?: string;
    icd10amDisplay?: string;
    sbsCode?: string;
    sbsDisplay?: string;
    achiCode?: string;
    achiDisplay?: string;
    loincCode?: string;
    loincDisplay?: string;
    sfdaCode?: string;
    sfdaDisplay?: string;
    atcCode?: string;
    rxnormCode?: string;
    cvxCode?: string;
    mappingEquivalence?: MappingEquivalence;
    confidence?: number;
}
