import { prisma as defaultPrisma } from '../lib/prisma.js';
export class PrismaTerminologyService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma || defaultPrisma;
    }
    async resolveCode(sourceCode, sourceSystemId, domain) {
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
    buildClinicalCodeFromConcept(concept, // Prisma model
    sourceCode, sourceSystemId, sourceDisplay) {
        const codings = concept.codings || [];
        const snomed = codings.find((c) => c.system.includes('snomed'));
        const icd10am = codings.find((c) => c.system.includes('icd-10-am'));
        const sbs = codings.find((c) => c.system.includes('sbs'));
        const loinc = codings.find((c) => c.system.includes('loinc'));
        const sfda = codings.find((c) => c.system.includes('sfda'));
        const atc = codings.find((c) => c.system.includes('atc'));
        const rxnorm = codings.find((c) => c.system.includes('rxnorm'));
        const cvx = codings.find((c) => c.system.includes('cvx'));
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
    async getAllConcepts() {
        const concepts = await this.prisma.terminologyConcept.findMany({ include: { codings: true } });
        return concepts.map(c => ({
            conceptId: c.id,
            preferredTerm: c.preferred_term,
            preferredTermAr: c.preferred_term_ar || undefined,
            domain: c.domain,
            codings: c.codings.map(cd => ({
                system: cd.system,
                code: cd.code,
                display: cd.display
            }))
        }));
    }
    async getAllMaps() {
        const maps = await this.prisma.terminologyMapping.findMany();
        return maps.map(m => ({
            mappingId: m.id,
            sourceSystemId: m.source_system_id,
            sourceCode: m.source_code,
            sourceDisplay: m.source_display || undefined,
            canonicalConceptId: m.canonical_concept_id,
            equivalence: m.equivalence,
            confidence: m.confidence,
            ruleVersion: m.rule_version
        }));
    }
}
//# sourceMappingURL=prisma-terminology-service.js.map