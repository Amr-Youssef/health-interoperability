import { prisma as defaultPrisma } from '../lib/prisma.js';
import type { PrismaClient } from '@prisma/client';
import { CanonicalConcept, ClinicalCode, TerminologyMapping } from '../core/domain/clinical-code.js';

export class PrismaTerminologyService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || defaultPrisma as unknown as PrismaClient;
  }

  async resolveCode(sourceCode: string, sourceSystemId: string, domain?: string): Promise<ClinicalCode> {
    const key = sourceCode.trim();

    // Try finding explicit mapping
    const mapping = await this.prisma.terminologyMapping.findFirst({
      where: {
        source_system_id: sourceSystemId,
        source_code: { equals: key, mode: 'insensitive' }
      }
    });

    if (mapping) {
      const concept = await this.prisma.terminologyConcept.findUnique({
        where: { id: mapping.canonical_concept_id },
        include: { codings: true }
      });
      if (concept) {
        return this.buildClinicalCodeFromConcept(concept, sourceCode, sourceSystemId, mapping.source_display || undefined);
      }
    }

    // Direct match against standard systems
    const conceptByCoding = await this.prisma.terminologyConcept.findFirst({
      where: {
        codings: {
          some: { code: { equals: key, mode: 'insensitive' } }
        }
      },
      include: { codings: true }
    });

    if (conceptByCoding) {
      const match = conceptByCoding.codings.find(c => c.code.toLowerCase() === key.toLowerCase());
      return this.buildClinicalCodeFromConcept(conceptByCoding, sourceCode, sourceSystemId, match?.display);
    }

    // Fallback: unmapped local code
    return {
      sourceCode: sourceCode.trim(),
      sourceSystem: `urn:${sourceSystemId}:local`,
      sourceDisplay: sourceCode
    };
  }

  private buildClinicalCodeFromConcept(
    concept: any, // Prisma model
    sourceCode: string,
    sourceSystemId: string,
    sourceDisplay?: string
  ): ClinicalCode {
    const codings = concept.codings || [];
    const snomed = codings.find((c: any) => c.system.includes('snomed'));
    const icd10am = codings.find((c: any) => c.system.includes('icd-10-am'));
    const sbs = codings.find((c: any) => c.system.includes('sbs'));
    const loinc = codings.find((c: any) => c.system.includes('loinc'));
    const sfda = codings.find((c: any) => c.system.includes('sfda'));
    const atc = codings.find((c: any) => c.system.includes('atc'));
    const rxnorm = codings.find((c: any) => c.system.includes('rxnorm'));
    const cvx = codings.find((c: any) => c.system.includes('cvx'));

    return {
      sourceCode,
      sourceSystem: `urn:${sourceSystemId}:local`,
      sourceDisplay: sourceDisplay || concept.preferred_term,
      snomedCode: snomed?.code,
      snomedDisplay: snomed?.display,
      icd10amCode: icd10am?.code,
      icd10amDisplay: icd10am?.display,
      sbsCode: sbs?.code,
      sbsDisplay: sbs?.display,
      loincCode: loinc?.code,
      loincDisplay: loinc?.display,
      sfdaCode: sfda?.code,
      sfdaDisplay: sfda?.display,
      atcCode: atc?.code,
      rxnormCode: rxnorm?.code,
      cvxCode: cvx?.code
    };
  }

  async getAllConcepts(): Promise<CanonicalConcept[]> {
    const concepts = await this.prisma.terminologyConcept.findMany({ include: { codings: true } });
    return concepts.map(c => ({
      conceptId: c.id,
      preferredTerm: c.preferred_term,
      preferredTermAr: c.preferred_term_ar || undefined,
      domain: c.domain as any,
      codings: c.codings.map(cd => ({
        system: cd.system,
        code: cd.code,
        display: cd.display
      }))
    }));
  }

  async getAllMaps(): Promise<TerminologyMapping[]> {
    const maps = await this.prisma.terminologyMapping.findMany();
    return maps.map(m => ({
      mappingId: m.id,
      sourceSystemId: m.source_system_id,
      sourceCode: m.source_code,
      sourceDisplay: m.source_display || undefined,
      canonicalConceptId: m.canonical_concept_id,
      equivalence: m.equivalence as any,
      confidence: m.confidence,
      ruleVersion: m.rule_version
    }));
  }
}
