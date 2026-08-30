import { CanonicalConcept, ClinicalCode, TerminologyMapping } from '../core/domain/clinical-code.js';
export declare class TerminologyService {
    private concepts;
    private localCodeMaps;
    constructor();
    private initializeStandardConcepts;
    private initializeLocalMappings;
    /**
     * Resolves a local or standard code to a multi-system Canonical ClinicalCode
     */
    resolveCode(sourceCode: string, sourceSystemId: string, domain?: string): Promise<ClinicalCode>;
    private findMappingByCodeOnly;
    private buildClinicalCodeFromConcept;
    getAllConcepts(): Promise<CanonicalConcept[]>;
    getAllMaps(): Promise<TerminologyMapping[]>;
}
