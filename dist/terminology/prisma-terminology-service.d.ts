import type { PrismaClient } from '@prisma/client';
import { CanonicalConcept, ClinicalCode, TerminologyMapping } from '../core/domain/clinical-code.js';
export declare class PrismaTerminologyService {
    private prisma;
    constructor(prisma?: PrismaClient);
    resolveCode(sourceCode: string, sourceSystemId: string, domain?: string): Promise<ClinicalCode>;
    private buildClinicalCodeFromConcept;
    getAllConcepts(): Promise<CanonicalConcept[]>;
    getAllMaps(): Promise<TerminologyMapping[]>;
}
