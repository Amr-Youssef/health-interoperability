import { CanonicalConcept, ClinicalCode, TerminologyMapping } from '../core/domain/clinical-code.js';

export class TerminologyService {
  private concepts: Map<string, CanonicalConcept> = new Map();
  private localCodeMaps: Map<string, TerminologyMapping> = new Map();

  constructor() {
    this.initializeStandardConcepts();
    this.initializeLocalMappings();
  }

  private initializeStandardConcepts() {
    // 1. Type 2 Diabetes Mellitus
    this.concepts.set('CONCEPT-T2DM', {
      conceptId: 'CONCEPT-T2DM',
      preferredTerm: 'Type 2 diabetes mellitus',
      preferredTermAr: 'داء السكري من النوع الثاني',
      domain: 'DIAGNOSIS',
      codings: [
        {
          system: 'http://snomed.info/sct',
          code: '44054006',
          display: 'Type 2 diabetes mellitus (disorder)'
        },
        {
          system: 'urn:sa:nhic:icd-10-am',
          code: 'E11',
          display: 'Type 2 diabetes mellitus'
        },
        {
          system: 'urn:sa:chi:sbs',
          code: 'SBS-E11',
          display: 'Type 2 diabetes mellitus management'
        }
      ]
    });

    // 2. Essential Hypertension
    this.concepts.set('CONCEPT-HTN', {
      conceptId: 'CONCEPT-HTN',
      preferredTerm: 'Essential (primary) hypertension',
      preferredTermAr: 'ارتفاع ضغط الدم الأولي',
      domain: 'DIAGNOSIS',
      codings: [
        {
          system: 'http://snomed.info/sct',
          code: '59621000',
          display: 'Essential hypertension (disorder)'
        },
        {
          system: 'urn:sa:nhic:icd-10-am',
          code: 'I10',
          display: 'Essential (primary) hypertension'
        },
        {
          system: 'urn:sa:chi:sbs',
          code: 'SBS-I10',
          display: 'Hypertension care'
        }
      ]
    });

    // 3. Glycated Hemoglobin (HbA1c)
    this.concepts.set('CONCEPT-HBA1C', {
      conceptId: 'CONCEPT-HBA1C',
      preferredTerm: 'Hemoglobin A1c/Hemoglobin.total in Blood',
      preferredTermAr: 'فحص الهيموجلوبين السكري (السكر التراكمي)',
      domain: 'LAB_TEST',
      codings: [
        {
          system: 'http://loinc.org',
          code: '4548-4',
          display: 'Hemoglobin A1c/Hemoglobin.total in Blood'
        },
        {
          system: 'urn:sa:chi:sbs:lab',
          code: 'SBS-LAB-1020',
          display: 'Glycated hemoglobin analysis'
        }
      ]
    });

    // 4. Fasting Blood Glucose
    this.concepts.set('CONCEPT-GLUCOSE-FASTING', {
      conceptId: 'CONCEPT-GLUCOSE-FASTING',
      preferredTerm: 'Fasting glucose [Mass/volume] in Blood',
      preferredTermAr: 'تحليل سكر الدم الصائم',
      domain: 'LAB_TEST',
      codings: [
        {
          system: 'http://loinc.org',
          code: '1558-6',
          display: 'Fasting glucose [Mass/volume] in Blood'
        },
        {
          system: 'urn:sa:chi:sbs:lab',
          code: 'SBS-LAB-1010',
          display: 'Fasting blood sugar'
        }
      ]
    });

    // 5. SFDA Drug: Metformin HCl 500mg (Glucophage / Diamet)
    this.concepts.set('CONCEPT-MED-METFORMIN-500', {
      conceptId: 'CONCEPT-MED-METFORMIN-500',
      preferredTerm: 'Metformin hydrochloride 500 mg oral tablet',
      preferredTermAr: 'ميتفورمين هيدروكلوريد 500 مجم أقراص فموية (جلوكوفاج / داياميت)',
      domain: 'MEDICATION',
      codings: [
        {
          system: 'http://sfda.gov.sa/sdc',
          code: '0628500100101',
          display: 'Glucophage 500mg Film-Coated Tablets (SPIMACO/Merck)'
        },
        {
          system: 'http://www.whocc.no/atc',
          code: 'A10BA02',
          display: 'Metformin'
        },
        {
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: '860975',
          display: 'Metformin hydrochloride 500 MG Oral Tablet'
        },
        {
          system: 'urn:sa:chi:sbs:pharma',
          code: 'SBS-MED-501',
          display: 'Metformin 500mg'
        }
      ]
    });

    // 6. SFDA Drug: Sitagliptin 100mg (Januvia)
    this.concepts.set('CONCEPT-MED-SITAGLIPTIN-100', {
      conceptId: 'CONCEPT-MED-SITAGLIPTIN-100',
      preferredTerm: 'Sitagliptin 100 mg oral tablet',
      preferredTermAr: 'سيتاغليبتين 100 مجم أقراص فموية (جانوفيا)',
      domain: 'MEDICATION',
      codings: [
        {
          system: 'http://sfda.gov.sa/sdc',
          code: '0628500300303',
          display: 'Januvia 100mg Film-Coated Tablets (MSD)'
        },
        {
          system: 'http://www.whocc.no/atc',
          code: 'A10BH01',
          display: 'Sitagliptin'
        },
        {
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: '593411',
          display: 'Sitagliptin 100 MG Oral Tablet'
        }
      ]
    });

    // 7. Saudi MOH Vaccine: Seasonal Influenza Vaccine
    this.concepts.set('CONCEPT-VAX-INFLUENZA', {
      conceptId: 'CONCEPT-VAX-INFLUENZA',
      preferredTerm: 'Influenza, injectable, quadrivalent',
      preferredTermAr: 'لقاح الإنفلونزا الموسمية الرباعي المعطل',
      domain: 'VACCINE',
      codings: [
        {
          system: 'urn:sa:moh:vaccines',
          code: 'SA-VAX-FLU-01',
          display: 'Quadrivalent Inactivated Influenza Vaccine'
        },
        {
          system: 'http://hl7.org/fhir/sid/cvx',
          code: '158',
          display: 'influenza, injectable, quadrivalent'
        },
        {
          system: 'http://sfda.gov.sa/sdc',
          code: '0628500900909',
          display: 'Vaxigrip Tetra Suspension for Injection'
        }
      ]
    });

    // 8. Saudi MOH Vaccine: COVID-19 mRNA Vaccine
    this.concepts.set('CONCEPT-VAX-COVID', {
      conceptId: 'CONCEPT-VAX-COVID',
      preferredTerm: 'COVID-19 mRNA vaccine',
      preferredTermAr: 'لقاح كوفيد-19 المعتمد',
      domain: 'VACCINE',
      codings: [
        {
          system: 'urn:sa:moh:vaccines',
          code: 'SA-VAX-COVID-01',
          display: 'COVID-19 mRNA Vaccine'
        },
        {
          system: 'http://hl7.org/fhir/sid/cvx',
          code: '208',
          display: 'COVID-19, mRNA, LNP-S, PF, 30 mcg/0.3 mL dose'
        }
      ]
    });

    // 9. Allergy: Penicillin / Beta-lactam
    this.concepts.set('CONCEPT-ALLERGY-PENICILLIN', {
      conceptId: 'CONCEPT-ALLERGY-PENICILLIN',
      preferredTerm: 'Allergy to Penicillin',
      preferredTermAr: 'حساسية مفرطة للبنسلين والمركبات المشتقة',
      domain: 'ALLERGY' as any,
      codings: [
        {
          system: 'http://snomed.info/sct',
          code: '764146007',
          display: 'Penicillin'
        },
        {
          system: 'http://snomed.info/sct',
          code: '91936005',
          display: 'Allergy to penicillin (disorder)'
        }
      ]
    });

    // 10. Allergy: Sulfonamide
    this.concepts.set('CONCEPT-ALLERGY-SULFA', {
      conceptId: 'CONCEPT-ALLERGY-SULFA',
      preferredTerm: 'Allergy to Sulfonamide',
      preferredTermAr: 'حساسية مركبات السلفا',
      domain: 'ALLERGY' as any,
      codings: [
        {
          system: 'http://snomed.info/sct',
          code: '294509007',
          display: 'Sulfonamide (substance)'
        },
        {
          system: 'http://snomed.info/sct',
          code: '91939003',
          display: 'Allergy to sulfonamide (disorder)'
        }
      ]
    });

    // 11. Diagnostic Panel: Comprehensive Metabolic Panel
    this.concepts.set('CONCEPT-PANEL-METABOLIC', {
      conceptId: 'CONCEPT-PANEL-METABOLIC',
      preferredTerm: 'Comprehensive Metabolic 2000 Panel',
      preferredTermAr: 'لوحة التقييم الأيضي والسكري الشامل',
      domain: 'LAB_TEST',
      codings: [
        {
          system: 'http://loinc.org',
          code: '24323-8',
          display: 'Comprehensive metabolic 2000 panel - Serum or Plasma'
        }
      ]
    });
  }

  private initializeLocalMappings() {
    // -------------------------------------------------------------
    // Hospital A (Legacy Arabic HIS local codes)
    // -------------------------------------------------------------
    this.localCodeMaps.set('hospital-a:سكري-2', {
      mappingId: 'map-ha-dx-01',
      sourceSystemId: 'hospital-a',
      sourceCode: 'سكري-2',
      sourceDisplay: 'داء السكري النوع الثاني',
      canonicalConceptId: 'CONCEPT-T2DM',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-a:ضغط-1', {
      mappingId: 'map-ha-dx-02',
      sourceSystemId: 'hospital-a',
      sourceCode: 'ضغط-1',
      sourceDisplay: 'ارتفاع ضغط الدم',
      canonicalConceptId: 'CONCEPT-HTN',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-a:سكر تراكمي', {
      mappingId: 'map-ha-lab-01',
      sourceSystemId: 'hospital-a',
      sourceCode: 'سكر تراكمي',
      sourceDisplay: 'فحص السكر التراكمي HbA1c',
      canonicalConceptId: 'CONCEPT-HBA1C',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-a:سكر_الدم_صائم', {
      mappingId: 'map-ha-lab-02',
      sourceSystemId: 'hospital-a',
      sourceCode: 'سكر_الدم_صائم',
      sourceDisplay: 'سكر الدم صائم',
      canonicalConceptId: 'CONCEPT-GLUCOSE-FASTING',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-a:دواء_ميتفورمين_500', {
      mappingId: 'map-ha-med-01',
      sourceSystemId: 'hospital-a',
      sourceCode: 'دواء_ميتفورمين_500',
      sourceDisplay: 'جلوكوفاج / ميتفورمين 500 مجم',
      canonicalConceptId: 'CONCEPT-MED-METFORMIN-500',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-a:تطعيم_الإنفلونزا_الموسمية', {
      mappingId: 'map-ha-vax-01',
      sourceSystemId: 'hospital-a',
      sourceCode: 'تطعيم_الإنفلونزا_الموسمية',
      sourceDisplay: 'لقاح الإنفلونزا الموسمية',
      canonicalConceptId: 'CONCEPT-VAX-INFLUENZA',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-a:بنسلين', {
      mappingId: 'map-ha-alg-01',
      sourceSystemId: 'hospital-a',
      sourceCode: 'بنسلين',
      sourceDisplay: 'حساسية بنسلين',
      canonicalConceptId: 'CONCEPT-ALLERGY-PENICILLIN',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-a:764146007', {
      mappingId: 'map-ha-alg-02',
      sourceSystemId: 'hospital-a',
      sourceCode: '764146007',
      sourceDisplay: 'Penicillin',
      canonicalConceptId: 'CONCEPT-ALLERGY-PENICILLIN',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    // -------------------------------------------------------------
    // Hospital B (Relational English HIS codes)
    // -------------------------------------------------------------
    this.localCodeMaps.set('hospital-b:E11.9', {
      mappingId: 'map-hb-dx-01',
      sourceSystemId: 'hospital-b',
      sourceCode: 'E11.9',
      sourceDisplay: 'Type 2 diabetes mellitus without complications',
      canonicalConceptId: 'CONCEPT-T2DM',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-b:HBA1C', {
      mappingId: 'map-hb-lab-01',
      sourceSystemId: 'hospital-b',
      sourceCode: 'HBA1C',
      sourceDisplay: 'Hemoglobin A1c',
      canonicalConceptId: 'CONCEPT-HBA1C',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-b:RX-MET-500', {
      mappingId: 'map-hb-med-01',
      sourceSystemId: 'hospital-b',
      sourceCode: 'RX-MET-500',
      sourceDisplay: 'Metformin HCl 500mg Oral Tab',
      canonicalConceptId: 'CONCEPT-MED-METFORMIN-500',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-b:RX-JAN-100', {
      mappingId: 'map-hb-med-02',
      sourceSystemId: 'hospital-b',
      sourceCode: 'RX-JAN-100',
      sourceDisplay: 'Januvia (Sitagliptin) 100mg Tab',
      canonicalConceptId: 'CONCEPT-MED-SITAGLIPTIN-100',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-b:VAC-FLU-QUAD', {
      mappingId: 'map-hb-vax-01',
      sourceSystemId: 'hospital-b',
      sourceCode: 'VAC-FLU-QUAD',
      sourceDisplay: 'Quadrivalent Influenza Vaccine IM',
      canonicalConceptId: 'CONCEPT-VAX-INFLUENZA',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-b:Sulfonamide', {
      mappingId: 'map-hb-alg-01',
      sourceSystemId: 'hospital-b',
      sourceCode: 'Sulfonamide',
      sourceDisplay: 'Sulfonamide',
      canonicalConceptId: 'CONCEPT-ALLERGY-SULFA',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-b:294509007', {
      mappingId: 'map-hb-alg-02',
      sourceSystemId: 'hospital-b',
      sourceCode: '294509007',
      sourceDisplay: 'Sulfonamide',
      canonicalConceptId: 'CONCEPT-ALLERGY-SULFA',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    // -------------------------------------------------------------
    // Hospital C (FHIR Native R4 codes)
    // -------------------------------------------------------------
    this.localCodeMaps.set('hospital-c:44054006', {
      mappingId: 'map-hc-dx-01',
      sourceSystemId: 'hospital-c',
      sourceCode: '44054006',
      sourceDisplay: 'Type 2 diabetes mellitus',
      canonicalConceptId: 'CONCEPT-T2DM',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-c:4548-4', {
      mappingId: 'map-hc-lab-01',
      sourceSystemId: 'hospital-c',
      sourceCode: '4548-4',
      sourceDisplay: 'Hemoglobin A1c/Hemoglobin.total in Blood',
      canonicalConceptId: 'CONCEPT-HBA1C',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-c:0628500100101', {
      mappingId: 'map-hc-med-01',
      sourceSystemId: 'hospital-c',
      sourceCode: '0628500100101',
      sourceDisplay: 'Glucophage 500mg',
      canonicalConceptId: 'CONCEPT-MED-METFORMIN-500',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });

    this.localCodeMaps.set('hospital-c:158', {
      mappingId: 'map-hc-vax-01',
      sourceSystemId: 'hospital-c',
      sourceCode: '158',
      sourceDisplay: 'influenza, injectable, quadrivalent',
      canonicalConceptId: 'CONCEPT-VAX-INFLUENZA',
      equivalence: 'EQUIVALENT',
      confidence: 1.0,
      ruleVersion: '1.0.0'
    });
  }

  /**
   * Resolves a local or standard code to a multi-system Canonical ClinicalCode
   */
  async resolveCode(sourceCode: string, sourceSystemId: string, domain?: string): Promise<ClinicalCode> {
    const key = `${sourceSystemId}:${sourceCode.trim()}`;
    const directMap = this.localCodeMaps.get(key) || this.findMappingByCodeOnly(sourceCode.trim());

    if (directMap) {
      const concept = this.concepts.get(directMap.canonicalConceptId);
      if (concept) {
        return this.buildClinicalCodeFromConcept(concept, sourceCode, sourceSystemId, directMap.sourceDisplay);
      }
    }

    // Direct match against standard systems
    for (const concept of this.concepts.values()) {
      const match = concept.codings.find(c => c.code.toLowerCase() === sourceCode.trim().toLowerCase());
      if (match) {
        return this.buildClinicalCodeFromConcept(concept, sourceCode, sourceSystemId, match.display);
      }
    }

    // Fallback: unmapped local code
    return {
      sourceCode: sourceCode.trim(),
      sourceSystem: `urn:${sourceSystemId}:local`,
      sourceDisplay: sourceCode
    };
  }

  private findMappingByCodeOnly(code: string): TerminologyMapping | null {
    for (const [k, v] of this.localCodeMaps.entries()) {
      if (v.sourceCode.toLowerCase() === code.toLowerCase()) return v;
    }
    return null;
  }

  private buildClinicalCodeFromConcept(
    concept: CanonicalConcept,
    sourceCode: string,
    sourceSystemId: string,
    sourceDisplay?: string
  ): ClinicalCode {
    const snomed = concept.codings.find(c => c.system.includes('snomed'));
    const icd10am = concept.codings.find(c => c.system.includes('icd-10-am'));
    const sbs = concept.codings.find(c => c.system.includes('sbs'));
    const loinc = concept.codings.find(c => c.system.includes('loinc'));
    const sfda = concept.codings.find(c => c.system.includes('sfda'));
    const atc = concept.codings.find(c => c.system.includes('atc'));
    const rxnorm = concept.codings.find(c => c.system.includes('rxnorm'));
    const cvx = concept.codings.find(c => c.system.includes('cvx'));

    return {
      sourceCode,
      sourceSystem: `urn:${sourceSystemId}:local`,
      sourceDisplay: sourceDisplay || concept.preferredTerm,
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
    return Array.from(this.concepts.values());
  }

  async getAllMaps(): Promise<TerminologyMapping[]> {
    return Array.from(this.localCodeMaps.values());
  }
}
