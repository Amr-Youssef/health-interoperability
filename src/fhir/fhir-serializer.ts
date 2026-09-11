import { CanonicalPatient } from '../core/domain/patient.js';
import { CanonicalEncounter } from '../core/domain/encounter.js';
import { CanonicalCondition } from '../core/domain/condition.js';
import { CanonicalObservation } from '../core/domain/observation.js';
import { CanonicalCoverage, CanonicalClaim, CanonicalClaimResponse } from '../core/domain/financial.js';
import { CanonicalMedicationRequest } from '../core/domain/medication.js';
import { CanonicalImmunization } from '../core/domain/immunization.js';
import { CanonicalAllergyIntolerance } from '../core/domain/allergy-intolerance.js';
import { CanonicalDiagnosticReport } from '../core/domain/diagnostic-report.js';
import { LongitudinalRecord } from '../core/domain/longitudinal-record.js';

export class FhirR4Serializer {
  /**
   * Serializes a CanonicalPatient to HL7 FHIR R4 Patient with NPHIES-aligned profiles
   */
  serializePatient(patient: CanonicalPatient, opts?: { maskNid?: boolean }): Record<string, any> {
    const mask = (v: string) => v.length >= 7 ? v[0] + 'XXXXX' + v.slice(-4) : 'XXXX';
    const fhirIdentifiers: any[] = [];

    for (const id of patient.identifiers) {
      if (id.type === 'NID') {
        const val = opts?.maskNid ? mask(id.value) : id.value;
        fhirIdentifiers.push({
          use: 'official',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'NI',
                display: 'National unique individual identifier'
              }
            ]
          },
          system: 'urn:sa:nid',
          value: val
        });
      } else if (id.type === 'IQAMA') {
        const iqVal = opts?.maskNid ? mask(id.value) : id.value;
        fhirIdentifiers.push({
          use: 'official',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'PRN',
                display: 'Resident ID / Iqama'
              }
            ]
          },
          system: 'urn:sa:iqama',
          value: iqVal
        });
      } else if (id.type === 'MRN') {
        fhirIdentifiers.push({
          use: 'secondary',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'MR',
                display: 'Medical Record Number'
              }
            ]
          },
          system: id.system || `urn:${id.sourceSystemId}:mrn`,
          value: id.value
        });
      }
    }

    const fhirNames: any[] = [];
    if (patient.givenNameAr || patient.familyNameAr) {
      fhirNames.push({
        use: 'official',
        family: patient.familyNameAr || patient.familyName,
        given: [patient.givenNameAr || patient.givenName],
        _family: {
          extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/language', valueCode: 'ar' }]
        }
      });
    }

    if (patient.givenName || patient.familyName) {
      fhirNames.push({
        use: 'official',
        family: patient.familyName,
        given: [patient.givenName]
      });
    }

    const extensions: any[] = [];
    if (patient.religion) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-religion',
        valueCodeableConcept: {
          coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/religion', code: 'islam', display: 'Islam' }]
        }
      });
    }
    if (patient.occupation) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-occupation',
        valueString: patient.occupation
      });
    }

    return {
      resourceType: 'Patient',
      id: (patient as any).internalIdUuid || patient.internalId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/NphiesPatient'],
        lastUpdated: patient.updatedAt
      },
      extension: extensions.length > 0 ? extensions : undefined,
      identifier: fhirIdentifiers,
      active: true,
      name: fhirNames,
      gender: patient.gender,
      birthDate: patient.birthDate,
      telecom: patient.phone ? [{ system: 'phone', value: patient.phone, use: 'mobile' }] : undefined
    };
  }

  /**
   * Serializes a CanonicalEncounter to HL7 FHIR R4 Encounter
   */
  serializeEncounter(encounter: CanonicalEncounter): Record<string, any> {
    const classCodeMap: Record<string, string> = {
      outpatient: 'AMB',
      inpatient: 'IMP',
      emergency: 'EMER',
      virtual: 'VR'
    };

    return {
      resourceType: 'Encounter',
      id: encounter.internalId,
      status: encounter.status,
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: classCodeMap[encounter.class] || 'AMB',
        display: encounter.class
      },
      subject: {
        reference: `Patient/${encounter.patientId}`
      },
      period: {
        start: encounter.period.start,
        end: encounter.period.end
      },
      serviceProvider: encounter.departmentAr ? { display: encounter.departmentAr } : undefined
    };
  }

  /**
   * Serializes a CanonicalCondition to HL7 FHIR R4 Condition with multi-system coding
   */
  serializeCondition(condition: CanonicalCondition): Record<string, any> {
    const codings: any[] = [];

    if (condition.code.snomedCode) {
      codings.push({
        system: 'http://snomed.info/sct',
        code: condition.code.snomedCode,
        display: condition.code.snomedDisplay || 'SNOMED CT Concept'
      });
    }

    if (condition.code.icd10amCode) {
      codings.push({
        system: 'urn:sa:nhic:icd-10-am',
        code: condition.code.icd10amCode,
        display: condition.code.icd10amDisplay || 'ICD-10-AM Code'
      });
    }

    if (condition.code.sbsCode) {
      codings.push({
        system: 'urn:sa:chi:sbs',
        code: condition.code.sbsCode,
        display: condition.code.sbsDisplay || 'Saudi Billing Code'
      });
    }

    if (condition.code.sourceCode) {
      codings.push({
        system: condition.code.sourceSystem || 'urn:source:local',
        code: condition.code.sourceCode,
        display: condition.code.sourceDisplay || condition.code.sourceCode
      });
    }

    return {
      resourceType: 'Condition',
      id: condition.internalId,
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: condition.clinicalStatus
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: condition.category
            }
          ]
        }
      ],
      code: {
        coding: codings,
        text: condition.code.sourceDisplay || condition.code.snomedDisplay || condition.code.sourceCode
      },
      subject: {
        reference: `Patient/${condition.patientId}`
      },
      recordedDate: condition.recordedDate,
      note: condition.note ? [{ text: condition.note }] : undefined
    };
  }

  /**
   * Serializes a CanonicalObservation to HL7 FHIR R4 Observation (LOINC Lab)
   */
  serializeObservation(obs: CanonicalObservation): Record<string, any> {
    const codings: any[] = [];

    if (obs.code.loincCode) {
      codings.push({
        system: 'http://loinc.org',
        code: obs.code.loincCode,
        display: obs.code.loincDisplay || 'LOINC Standard Lab Code'
      });
    }

    if (obs.code.sbsCode) {
      codings.push({
        system: 'urn:sa:chi:sbs:lab',
        code: obs.code.sbsCode,
        display: obs.code.sbsDisplay || 'SBS Lab Code'
      });
    }

    if (obs.code.sourceCode) {
      codings.push({
        system: obs.code.sourceSystem || 'urn:source:local',
        code: obs.code.sourceCode,
        display: obs.code.sourceDisplay || obs.code.sourceCode
      });
    }

    return {
      resourceType: 'Observation',
      id: obs.internalId,
      status: obs.status,
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: obs.category
            }
          ]
        }
      ],
      code: {
        coding: codings,
        text: obs.code.sourceDisplay || obs.code.loincDisplay || obs.code.sourceCode
      },
      subject: {
        reference: `Patient/${obs.patientId}`
      },
      effectiveDateTime: obs.effectiveDateTime,
      valueQuantity: obs.valueQuantity ? {
        value: obs.valueQuantity.value,
        unit: obs.valueQuantity.unit,
        system: 'http://unitsofmeasure.org',
        code: obs.valueQuantity.unit
      } : undefined,
      referenceRange: obs.referenceRange ? [
        {
          text: obs.referenceRange.text || `${obs.referenceRange.low ?? ''} - ${obs.referenceRange.high ?? ''} ${obs.referenceRange.unit ?? ''}`
        }
      ] : undefined
    };
  }

  /**
   * Serializes a CanonicalCoverage to NPHIES-compliant FHIR R4 Coverage
   */
  serializeCoverage(cov: CanonicalCoverage): Record<string, any> {
    return {
      resourceType: 'Coverage',
      id: cov.internalId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/NphiesCoverage']
      },
      status: cov.status,
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'HIP',
            display: 'health insurance plan'
          }
        ]
      },
      subscriberId: cov.memberId,
      beneficiary: {
        reference: `Patient/${cov.patientId}`
      },
      period: {
        start: cov.period.start,
        end: cov.period.end
      },
      payor: [
        {
          identifier: {
            system: 'http://nphies.sa/license/payer-license',
            value: cov.payerId
          },
          display: cov.payerNameAr || cov.payerName
        }
      ],
      class: [
        {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                code: 'plan'
              }
            ]
          },
          value: cov.networkClass,
          name: `${cov.networkClass} Network`
        }
      ],
      costToBeneficiary: [
        {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/coverage-copay-type',
                code: 'copaypct',
                display: 'Copayment Percentage'
              }
            ]
          },
          valueQuantity: {
            value: cov.copayPercentage,
            unit: '%'
          }
        }
      ]
    };
  }

  /**
   * Serializes a CanonicalClaim to NPHIES-compliant FHIR R4 Claim
   */
  serializeClaim(claim: CanonicalClaim): Record<string, any> {
    return {
      resourceType: 'Claim',
      id: claim.internalId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/NphiesClaim']
      },
      status: 'active',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/claim-type',
            code: claim.claimType
          }
        ]
      },
      subType: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
            code: claim.subType === 'outpatient' ? 'op' : claim.subType === 'inpatient' ? 'ip' : 'emr',
            display: claim.subType
          }
        ]
      },
      use: claim.use,
      patient: {
        reference: `Patient/${claim.patientId}`
      },
      created: claim.submissionDate,
      provider: {
        identifier: {
          system: 'http://nphies.sa/license/provider-license',
          value: claim.serviceProviderId
        }
      },
      priority: {
        coding: [{ code: 'normal' }]
      },
      insurance: [
        {
          sequence: 1,
          focal: true,
          coverage: {
            reference: `Coverage/${claim.coverageId}`
          }
        }
      ],
      diagnosis: claim.diagnoses.map((d, idx) => ({
        sequence: d.sequence || idx + 1,
        diagnosisCodeableConcept: {
          coding: [
            d.code.icd10amCode ? {
              system: 'urn:sa:nhic:icd-10-am',
              code: d.code.icd10amCode,
              display: d.code.icd10amDisplay || d.code.sourceDisplay
            } : null,
            d.code.sbsCode ? {
              system: 'urn:sa:chi:sbs',
              code: d.code.sbsCode
            } : null
          ].filter(Boolean)
        }
      })),
      item: claim.items.map((it, idx) => ({
        sequence: it.sequence || idx + 1,
        productOrService: {
          coding: [
            {
              system: 'urn:sa:chi:sbs',
              code: it.serviceCode?.sbsCode || it.serviceCode?.sourceCode || 'SBS-GEN-01',
              display: it.serviceNameAr || it.serviceName
            }
          ]
        },
        unitPrice: {
          value: it.unitPriceSAR,
          currency: 'SAR'
        },
        net: {
          value: it.netClaimedSAR,
          currency: 'SAR'
        }
      })),
      total: {
        value: claim.totalInsurerClaimedSAR,
        currency: 'SAR'
      }
    };
  }

  /**
   * Serializes a CanonicalClaimResponse to NPHIES FHIR R4 ClaimResponse
   */
  serializeClaimResponse(cr: CanonicalClaimResponse): Record<string, any> {
    return {
      resourceType: 'ClaimResponse',
      id: cr.internalId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/NphiesClaimResponse']
      },
      status: 'active',
      type: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }]
      },
      use: 'claim',
      patient: {
        reference: `Patient/${cr.patientId}`
      },
      created: cr.adjudicatedAt,
      outcome: cr.outcome,
      disposition: cr.disposition,
      request: {
        reference: `Claim/${cr.claimId}`
      },
      total: [
        {
          category: {
            coding: [{ code: 'submitted' }]
          },
          amount: { value: cr.totalApprovedSAR, currency: 'SAR' }
        },
        {
          category: {
            coding: [{ code: 'benefit' }]
          },
          amount: { value: cr.totalPayerPayableSAR, currency: 'SAR' }
        }
      ],
      item: cr.itemAdjudications.map(it => ({
        itemSequence: it.sequence,
        adjudication: [
          {
            category: {
              coding: [{ code: 'benefit' }]
            },
            amount: { value: it.payerPayableSAR, currency: 'SAR' }
          },
          {
            category: {
              coding: [{ code: 'copay' }]
            },
            amount: { value: it.patientCopaySAR, currency: 'SAR' }
          }
        ]
      }))
    };
  }

  /**
   * Serializes a CanonicalMedicationRequest to HL7 FHIR R4 MedicationRequest with SFDA SDC
   */
  serializeMedicationRequest(rx: CanonicalMedicationRequest): Record<string, any> {
    const codings: any[] = [];

    // SFDA Saudi Drug Code
    if (rx.medication.code.sfdaCode) {
      codings.push({
        system: 'http://sfda.gov.sa/sdc',
        code: rx.medication.code.sfdaCode,
        display: rx.medication.code.sfdaDisplay || 'SFDA Registered Drug'
      });
    }

    // ATC Code
    if (rx.medication.code.atcCode) {
      codings.push({
        system: 'http://www.whocc.no/atc',
        code: rx.medication.code.atcCode,
        display: 'ATC Classification'
      });
    }

    // RxNorm Code
    if (rx.medication.code.rxnormCode) {
      codings.push({
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: rx.medication.code.rxnormCode,
        display: 'RxNorm Concept'
      });
    }

    // Source Code
    if (rx.medication.code.sourceCode) {
      codings.push({
        system: rx.medication.code.sourceSystem || 'urn:source:local',
        code: rx.medication.code.sourceCode,
        display: rx.medication.code.sourceDisplay || rx.medication.code.sourceCode
      });
    }

    return {
      resourceType: 'MedicationRequest',
      id: rx.internalId,
      status: rx.status,
      intent: rx.intent,
      medicationCodeableConcept: {
        coding: codings,
        text: rx.medication.code.sourceDisplay || rx.medication.code.sfdaDisplay || 'Prescribed Medication'
      },
      subject: {
        reference: `Patient/${rx.patientId}`
      },
      encounter: rx.encounterId ? { reference: `Encounter/${rx.encounterId}` } : undefined,
      authoredOn: rx.authoredOn,
      requester: rx.requesterPractitionerName ? { display: rx.requesterPractitionerName } : undefined,
      dosageInstruction: rx.dosageInstruction.map(d => ({
        text: d.textAr || d.text,
        timing: {
          repeat: {
            frequency: d.timing?.frequency || 1,
            period: d.timing?.period || 1,
            periodUnit: d.timing?.periodUnit || 'd'
          }
        },
        route: {
          text: d.route
        },
        doseAndRate: [
          {
            doseQuantity: {
              value: d.doseQuantity?.value || 1,
              unit: d.doseQuantity?.unit || 'TAB'
            }
          }
        ]
      })),
      dispenseRequest: rx.dispenseRequest ? {
        numberOfRepeatsAllowed: rx.dispenseRequest.numberOfRepeatsAllowed,
        quantity: {
          value: rx.dispenseRequest.quantity?.value || 30,
          unit: rx.dispenseRequest.quantity?.unit || 'TAB'
        },
        expectedSupplyDuration: {
          value: rx.dispenseRequest.expectedSupplyDurationDays || 30,
          unit: 'd'
        }
      } : undefined
    };
  }

  /**
   * Serializes a CanonicalImmunization to HL7 FHIR R4 Immunization
   */
  serializeImmunization(imm: CanonicalImmunization): Record<string, any> {
    const codings: any[] = [];

    if (imm.vaccineCode.cvxCode) {
      codings.push({
        system: 'http://hl7.org/fhir/sid/cvx',
        code: imm.vaccineCode.cvxCode,
        display: 'CVX Vaccine Standard'
      });
    }

    if (imm.vaccineCode.sourceCode) {
      codings.push({
        system: imm.vaccineCode.sourceSystem || 'urn:sa:moh:vaccines',
        code: imm.vaccineCode.sourceCode,
        display: imm.vaccineCode.sourceDisplay || imm.vaccineCode.sourceCode
      });
    }

    return {
      resourceType: 'Immunization',
      id: imm.internalId,
      status: imm.status,
      vaccineCode: {
        coding: codings,
        text: imm.vaccineCode.sourceDisplay || 'Vaccine'
      },
      patient: {
        reference: `Patient/${imm.patientId}`
      },
      encounter: imm.encounterId ? { reference: `Encounter/${imm.encounterId}` } : undefined,
      occurrenceDateTime: imm.occurrenceDateTime,
      lotNumber: imm.lotNumber,
      expirationDate: imm.expirationDate,
      site: imm.site ? { text: imm.site } : undefined,
      route: imm.route ? { text: imm.route } : undefined
    };
  }

  /**
   * Bundles all patient resources into a FHIR R4 Bundle ($everything longitudinal response)
   */
  serializeLongitudinalBundle(record: LongitudinalRecord): Record<string, any> {
    const entries: any[] = [];

    // Patient
    entries.push({
      fullUrl: `urn:uuid:${record.patient.internalId}`,
      resource: this.serializePatient(record.patient)
    });

    // Coverages
    if (record.coverages) {
      for (const cov of record.coverages) {
        entries.push({
          fullUrl: `urn:uuid:${cov.internalId}`,
          resource: this.serializeCoverage(cov)
        });
      }
    }

    // Encounters
    for (const enc of record.encounters) {
      entries.push({
        fullUrl: `urn:uuid:${enc.internalId}`,
        resource: this.serializeEncounter(enc)
      });
    }

    // Conditions
    for (const cond of record.conditions) {
      entries.push({
        fullUrl: `urn:uuid:${cond.internalId}`,
        resource: this.serializeCondition(cond)
      });
    }

    // Observations
    for (const obs of record.observations) {
      entries.push({
        fullUrl: `urn:uuid:${obs.internalId}`,
        resource: this.serializeObservation(obs)
      });
    }

    // Claims
    if (record.claims) {
      for (const clm of record.claims) {
        entries.push({
          fullUrl: `urn:uuid:${clm.internalId}`,
          resource: this.serializeClaim(clm)
        });
      }
    }

    // MedicationRequests
    if (record.medicationRequests) {
      for (const rx of record.medicationRequests) {
        entries.push({
          fullUrl: `urn:uuid:${rx.internalId}`,
          resource: this.serializeMedicationRequest(rx)
        });
      }
    }

    // Immunizations
    if (record.immunizations) {
      for (const imm of record.immunizations) {
        entries.push({
          fullUrl: `urn:uuid:${imm.internalId}`,
          resource: this.serializeImmunization(imm)
        });
      }
    }

    // Allergies & Intolerances
    if (record.allergies) {
      for (const a of record.allergies) {
        entries.push({
          fullUrl: `urn:uuid:${a.internalId}`,
          resource: this.serializeAllergyIntolerance(a)
        });
      }
    }

    // Diagnostic Reports
    if (record.diagnosticReports) {
      for (const d of record.diagnosticReports) {
        entries.push({
          fullUrl: `urn:uuid:${d.internalId}`,
          resource: this.serializeDiagnosticReport(d)
        });
      }
    }

    const sr: any = (record as any).selfReported;
    if (sr) {
      const pushUnconfirmed = (items: any[], toFhir: (x: any) => any) => {
        for (const it of items || []) {
          try {
            const r = toFhir(it);
            r.verificationStatus = r.verificationStatus || { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'unconfirmed' }], text: 'UNVERIFIED - patient self-reported' };
            r.meta = Object.assign({}, r.meta, { tag: [{ system: 'urn:sa:source', code: 'PATIENT', display: 'Self-reported - UNVERIFIED, for review only' }] });
            entries.push({ fullUrl: 'urn:uuid:' + (it.id || it.internalId || Math.random().toString(36).slice(2)), resource: r });
          } catch { /* skip bad item */ }
        }
      };
      pushUnconfirmed(sr.medications, (m: any) => ({ resourceType: 'MedicationStatement', id: m.id, status: 'recorded', medicationCodeableConcept: { text: m.medication_name || m.medicationName }, dosage: [{ text: [m.dose, m.frequency].filter(Boolean).join(' ') }], dateAsserted: m.recorded_at || m.recordedAt }));
      pushUnconfirmed(sr.conditions, (c: any) => ({ resourceType: 'Condition', id: c.id, clinicalStatus: { coding: [{ code: 'active' }] }, code: { text: c.condition_name || c.conditionName } }));
      pushUnconfirmed(sr.allergies, (a: any) => ({ resourceType: 'AllergyIntolerance', id: a.id, clinicalStatus: { coding: [{ code: 'active' }] }, code: { text: a.allergen_name || a.allergenName } }));
      pushUnconfirmed(sr.vitals, (v: any) => ({ resourceType: 'Observation', id: v.id, status: 'preliminary', code: { text: v.observation_type || v.observationType }, valueQuantity: v.value_quantity != null ? { value: Number(v.value_quantity) } : undefined }));
    }

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries
    };
  }

  /**
   * Serializes a CanonicalAllergyIntolerance to HL7 FHIR R4 AllergyIntolerance
   */
  serializeAllergyIntolerance(allergy: CanonicalAllergyIntolerance): Record<string, any> {
    const codings: any[] = [];

    if (allergy.substanceCode?.snomedCode) {
      codings.push({
        system: 'http://snomed.info/sct',
        code: allergy.substanceCode.snomedCode,
        display: allergy.substanceCode.snomedDisplay || allergy.substanceText
      });
    }

    if (allergy.substanceCode?.sourceCode) {
      codings.push({
        system: allergy.substanceCode.sourceSystem || 'urn:source:allergy',
        code: allergy.substanceCode.sourceCode,
        display: allergy.substanceCode.sourceDisplay || allergy.substanceText
      });
    }

    return {
      resourceType: 'AllergyIntolerance',
      id: allergy.internalId,
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: allergy.clinicalStatus
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: allergy.verificationStatus
          }
        ]
      },
      type: allergy.type,
      category: [allergy.category],
      criticality: allergy.criticality,
      code: {
        coding: codings,
        text: allergy.substanceTextAr || allergy.substanceText
      },
      patient: {
        reference: `Patient/${allergy.patientId}`
      },
      recordedDate: allergy.recordedDate,
      reaction: allergy.reactions?.map(r => ({
        manifestation: [
          {
            coding: r.manifestationCode?.snomedCode ? [
              {
                system: 'http://snomed.info/sct',
                code: r.manifestationCode.snomedCode,
                display: r.manifestationCode.snomedDisplay || r.manifestationText
              }
            ] : undefined,
            text: r.manifestationTextAr || r.manifestationText
          }
        ],
        severity: r.severity
      }))
    };
  }

  /**
   * Serializes a CanonicalDiagnosticReport to HL7 FHIR R4 DiagnosticReport
   */
  serializeDiagnosticReport(report: CanonicalDiagnosticReport): Record<string, any> {
    const codings: any[] = [];

    if (report.code?.loincCode) {
      codings.push({
        system: 'http://loinc.org',
        code: report.code.loincCode,
        display: report.code.loincDisplay || 'Diagnostic Report'
      });
    }

    if (report.code?.sourceCode) {
      codings.push({
        system: report.code.sourceSystem || 'urn:source:report',
        code: report.code.sourceCode,
        display: report.code.sourceDisplay || report.code.sourceCode
      });
    }

    return {
      resourceType: 'DiagnosticReport',
      id: report.internalId,
      status: report.status,
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: report.category
            }
          ]
        }
      ],
      code: {
        coding: codings,
        text: report.code?.sourceDisplay || report.code?.loincDisplay || 'Laboratory / Diagnostic Report'
      },
      subject: {
        reference: `Patient/${report.patientId}`
      },
      encounter: report.encounterId ? {
        reference: `Encounter/${report.encounterId}`
      } : undefined,
      issued: report.issued,
      result: report.resultObservationIds?.map(obsId => ({
        reference: `Observation/${obsId}`
      })),
      conclusion: report.conclusionAr || report.conclusion
    };
  }

  /**
   * Serializes a PatientConsentDirective into HL7 FHIR R4 Consent resource (Saudi PDPL compliant)
   */
  serializeConsent(directive: any): Record<string, any> {
    return {
      resourceType: 'Consent',
      id: `consent-${directive.patientId}`,
      status: 'active',
      scope: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: 'patient-privacy',
            display: 'Privacy Consent'
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
              code: 'IDSCL',
              display: 'Information Disclosure'
            }
          ]
        }
      ],
      patient: {
        reference: `Patient/${directive.patientId}`
      },
      dateTime: directive.lastUpdated,
      policyRule: {
        coding: [
          {
            system: 'urn:sa:sdaia:pdpl',
            code: directive.policy,
            display: directive.policy === 'OPT_IN_FULL' ? 'Full Health Data Exchange Opt-In' : 'Restricted Policy'
          }
        ]
      },
      provision: {
        type: directive.policy === 'OPT_IN_FULL' ? 'permit' : 'deny',
        purpose: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
            code: 'TREAT',
            display: 'Treatment'
          }
        ]
      }
    };
  }
}
