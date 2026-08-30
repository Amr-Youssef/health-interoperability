import { PrismaClient } from '@prisma/client';
import { CanonicalPatient } from '../core/domain/patient.js';
import { CanonicalEncounter } from '../core/domain/encounter.js';
import { CanonicalCondition } from '../core/domain/condition.js';
import { CanonicalObservation } from '../core/domain/observation.js';
import { CanonicalOrganization } from '../core/domain/organization.js';
import { CanonicalPractitioner } from '../core/domain/practitioner.js';
import { CanonicalCoverage, CanonicalClaim, CanonicalClaimResponse } from '../core/domain/financial.js';
import { CanonicalMedicationRequest } from '../core/domain/medication.js';
import { CanonicalImmunization } from '../core/domain/immunization.js';
import { CanonicalAllergyIntolerance } from '../core/domain/allergy-intolerance.js';
import { CanonicalDiagnosticReport } from '../core/domain/diagnostic-report.js';

export interface LongitudinalRecord {
  patient: CanonicalPatient;
  encounters: CanonicalEncounter[];
  conditions: CanonicalCondition[];
  observations: CanonicalObservation[];
  coverages?: CanonicalCoverage[];
  claims?: CanonicalClaim[];
  medicationRequests?: CanonicalMedicationRequest[];
  immunizations?: CanonicalImmunization[];
  allergies?: CanonicalAllergyIntolerance[];
  diagnosticReports?: CanonicalDiagnosticReport[];
}

export class PrismaCanonicalStore {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  // PATIENT
  async savePatient(patient: CanonicalPatient): Promise<string> {
    const existing = await this.prisma.patient.findUnique({ where: { internal_id: patient.internalId } });
    if (existing) {
      await this.prisma.patient.update({
        where: { internal_id: patient.internalId },
        data: {
          first_name: patient.givenName,
          last_name: patient.familyName,
          first_name_ar: patient.givenNameAr,
          last_name_ar: patient.familyNameAr,
          birth_date: patient.birthDate ? new Date(patient.birthDate) : null,
          gender: patient.gender,
          phone: patient.phone,
          email: patient.email,
          status: 'ACTIVE',
          source_system_id: patient.provenance?.sourceSystemId,
          source_record_id: patient.provenance?.sourceRecordId
        }
      });
      // Handle identifiers
      if (patient.identifiers) {
        for (const id of patient.identifiers) {
          const existingId = await this.prisma.patientIdentifier.findFirst({
            where: { patient_id: existing.id, type: id.type, value: id.value }
          });
          if (!existingId) {
             await this.prisma.patientIdentifier.create({
               data: {
                 patient_id: existing.id,
                 value: id.value,
                 type: id.type,
                 system: id.system,
                 source_system_id: id.sourceSystemId,
                 first_seen_at: id.firstSeenAt ? new Date(id.firstSeenAt) : new Date()
               }
             });
          }
        }
      }
      return existing.internal_id;
    } else {
      const created = await this.prisma.patient.create({
        data: {
          internal_id: patient.internalId,
          first_name: patient.givenName,
          last_name: patient.familyName,
          first_name_ar: patient.givenNameAr,
          last_name_ar: patient.familyNameAr,
          birth_date: patient.birthDate ? new Date(patient.birthDate) : null,
          gender: patient.gender,
          phone: patient.phone,
          email: patient.email,
          status: 'ACTIVE',
          source_system_id: patient.provenance?.sourceSystemId,
          source_record_id: patient.provenance?.sourceRecordId,
          identifiers: {
            create: patient.identifiers?.map(id => ({
              value: id.value,
              type: id.type,
              system: id.system,
              source_system_id: id.sourceSystemId,
              first_seen_at: id.firstSeenAt ? new Date(id.firstSeenAt) : new Date()
            })) || []
          }
        }
      });
      return created.internal_id;
    }
  }

  private mapPatientToCanonical(p: any): CanonicalPatient {
    return {
      internalId: p.internal_id,
      identifiers: p.identifiers.map((i: any) => ({
        value: i.value,
        type: i.type,
        system: i.system,
        sourceSystemId: i.source_system_id,
        firstSeenAt: i.first_seen_at.toISOString(),
        isActive: i.is_active
      })),
      givenName: p.first_name || '',
      familyName: p.last_name || '',
      givenNameAr: p.first_name_ar || undefined,
      familyNameAr: p.last_name_ar || undefined,
      phone: p.phone || undefined,
      email: p.email || undefined,
      gender: p.gender,
      birthDate: p.birth_date ? p.birth_date.toISOString().split('T')[0] : '',
      provenance: {
        sourceSystemId: p.source_system_id,
        sourceRecordId: p.source_record_id,
        rawRecordId: 'DB',
        adapterVersion: '1.0',
        mappingVersion: '1.0',
        terminologyMapVersion: '1.0',
        ingestedAt: new Date().toISOString(),
        transformedAt: new Date().toISOString(),
        persistedAt: new Date().toISOString(),
        validationScore: 100,
        validationDecision: 'ACCEPTED'
      }
    };
  }

  async getPatient(internalId: string): Promise<CanonicalPatient | null> {
    const p = await this.prisma.patient.findUnique({
      where: { internal_id: internalId },
      include: { identifiers: true }
    });
    return p ? this.mapPatientToCanonical(p) : null;
  }

  async findPatientByIdentifier(value: string, sourceSystemId?: string): Promise<CanonicalPatient | null> {
    const where: any = { value: value.trim() };
    if (sourceSystemId) where.source_system_id = sourceSystemId;
    const id = await this.prisma.patientIdentifier.findFirst({
      where,
      include: { patient: { include: { identifiers: true } } }
    });
    return id ? this.mapPatientToCanonical(id.patient) : null;
  }

  async findPatientBySourceRecordId(sourceSystemId: string, sourceRecordId: string): Promise<CanonicalPatient | null> {
    const p = await this.prisma.patient.findFirst({
      where: { source_system_id: sourceSystemId, source_record_id: sourceRecordId },
      include: { identifiers: true }
    });
    return p ? this.mapPatientToCanonical(p) : null;
  }

  async getAllPatients(): Promise<CanonicalPatient[]> {
    const patients = await this.prisma.patient.findMany({ include: { identifiers: true } });
    return patients.map(p => this.mapPatientToCanonical(p));
  }

  // ENCOUNTER
  private mapEncounterToCanonical(e: any): CanonicalEncounter {
    return {
      internalId: e.internal_id,
      patientId: e.patient_id,
      status: e.status,
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: e.encounter_class },
      period: {
        start: e.period_start ? e.period_start.toISOString() : '',
        end: e.period_end ? e.period_end.toISOString() : undefined
      },
      sourceVisitId: e.source_visit_id,
      provenance: { sourceSystemId: e.source_system_id, sourceRecordId: e.source_record_id }
    };
  }

  async saveEncounter(enc: CanonicalEncounter): Promise<string> {
    await this.prisma.encounter.upsert({
      where: { internal_id: enc.internalId },
      update: {
        patient_id: enc.patientId,
        status: enc.status,
        encounter_class: enc.class?.code,
        period_start: enc.period?.start ? new Date(enc.period.start) : null,
        period_end: enc.period?.end ? new Date(enc.period.end) : null,
        source_visit_id: enc.sourceVisitId,
        source_system_id: enc.provenance?.sourceSystemId,
        source_record_id: enc.provenance?.sourceRecordId
      },
      create: {
        internal_id: enc.internalId,
        patient_id: enc.patientId,
        status: enc.status,
        encounter_class: enc.class?.code,
        period_start: enc.period?.start ? new Date(enc.period.start) : null,
        period_end: enc.period?.end ? new Date(enc.period.end) : null,
        source_visit_id: enc.sourceVisitId,
        source_system_id: enc.provenance?.sourceSystemId,
        source_record_id: enc.provenance?.sourceRecordId
      }
    });
    return enc.internalId;
  }

  async getEncounter(internalId: string): Promise<CanonicalEncounter | null> {
    const e = await this.prisma.encounter.findUnique({ where: { internal_id: internalId } });
    return e ? this.mapEncounterToCanonical(e) : null;
  }

  async findEncounterBySourceVisitId(sourceSystemId: string, sourceVisitId: string): Promise<CanonicalEncounter | null> {
    const e = await this.prisma.encounter.findFirst({
      where: { source_system_id: sourceSystemId, source_visit_id: sourceVisitId }
    });
    return e ? this.mapEncounterToCanonical(e) : null;
  }

  async getEncountersByPatient(patientId: string): Promise<CanonicalEncounter[]> {
    const list = await this.prisma.encounter.findMany({
      where: { patient_id: patientId },
      orderBy: { period_start: 'desc' }
    });
    return list.map(e => this.mapEncounterToCanonical(e));
  }

  async getAllEncounters(): Promise<CanonicalEncounter[]> {
    const list = await this.prisma.encounter.findMany();
    return list.map(e => this.mapEncounterToCanonical(e));
  }

  // CONDITIONS
  private mapConditionToCanonical(c: any): CanonicalCondition {
    return {
      internalId: c.internal_id,
      patientId: c.patient_id,
      encounterId: c.encounter_id || undefined,
      clinicalStatus: c.clinical_status,
      verificationStatus: c.verification_status,
      code: {
        sourceCode: c.code_source_code,
        sourceSystem: c.code_source_system,
        sourceDisplay: c.code_source_display,
        snomedCode: c.code_snomed_code,
        snomedDisplay: c.code_snomed_display,
        icd10amCode: c.code_icd10am_code,
        icd10amDisplay: c.code_icd10am_display
      },
      recordedDate: c.recorded_date ? c.recorded_date.toISOString() : '',
      provenance: { sourceSystemId: c.source_system_id, sourceRecordId: c.source_record_id }
    };
  }

  async saveCondition(cond: CanonicalCondition): Promise<string> {
    await this.prisma.condition.upsert({
      where: { internal_id: cond.internalId },
      update: {
        patient_id: cond.patientId,
        encounter_id: cond.encounterId,
        clinical_status: cond.clinicalStatus,
        verification_status: cond.verificationStatus,
        code_source_code: cond.code.sourceCode,
        code_source_system: cond.code.sourceSystem,
        code_source_display: cond.code.sourceDisplay,
        code_snomed_code: cond.code.snomedCode,
        code_snomed_display: cond.code.snomedDisplay,
        code_icd10am_code: cond.code.icd10amCode,
        code_icd10am_display: cond.code.icd10amDisplay,
        recorded_date: cond.recordedDate ? new Date(cond.recordedDate) : null,
        source_system_id: cond.provenance?.sourceSystemId,
        source_record_id: cond.provenance?.sourceRecordId
      },
      create: {
        internal_id: cond.internalId,
        patient_id: cond.patientId,
        encounter_id: cond.encounterId,
        clinical_status: cond.clinicalStatus,
        verification_status: cond.verificationStatus,
        code_source_code: cond.code.sourceCode,
        code_source_system: cond.code.sourceSystem,
        code_source_display: cond.code.sourceDisplay,
        code_snomed_code: cond.code.snomedCode,
        code_snomed_display: cond.code.snomedDisplay,
        code_icd10am_code: cond.code.icd10amCode,
        code_icd10am_display: cond.code.icd10amDisplay,
        recorded_date: cond.recordedDate ? new Date(cond.recordedDate) : null,
        source_system_id: cond.provenance?.sourceSystemId,
        source_record_id: cond.provenance?.sourceRecordId
      }
    });
    return cond.internalId;
  }

  async getConditionsByPatient(patientId: string): Promise<CanonicalCondition[]> {
    const list = await this.prisma.condition.findMany({
      where: { patient_id: patientId },
      orderBy: { recorded_date: 'desc' }
    });
    return list.map(c => this.mapConditionToCanonical(c));
  }

  async getAllConditions(): Promise<CanonicalCondition[]> {
    const list = await this.prisma.condition.findMany();
    return list.map(c => this.mapConditionToCanonical(c));
  }

  // OBSERVATION
  private mapObservationToCanonical(o: any): CanonicalObservation {
    return {
      internalId: o.internal_id,
      patientId: o.patient_id,
      encounterId: o.encounter_id || undefined,
      status: o.status,
      code: {
        sourceCode: o.code_source_code,
        sourceSystem: o.code_source_system,
        sourceDisplay: o.code_source_display,
        loincCode: o.code_loinc_code,
        loincDisplay: o.code_loinc_display,
        sbsCode: o.code_sbs_code,
        sbsDisplay: o.code_sbs_display
      },
      value: {
        value: o.value_quantity,
        unit: o.value_unit,
        stringValue: o.value_string
      },
      effectiveDateTime: o.effective_date ? o.effective_date.toISOString() : '',
      provenance: { sourceSystemId: o.source_system_id, sourceRecordId: o.source_record_id }
    };
  }

  async saveObservation(obs: CanonicalObservation): Promise<string> {
    await this.prisma.observation.upsert({
      where: { internal_id: obs.internalId },
      update: {
        patient_id: obs.patientId,
        encounter_id: obs.encounterId,
        status: obs.status,
        code_source_code: obs.code.sourceCode,
        code_source_system: obs.code.sourceSystem,
        code_source_display: obs.code.sourceDisplay,
        code_loinc_code: obs.code.loincCode,
        code_loinc_display: obs.code.loincDisplay,
        code_sbs_code: obs.code.sbsCode,
        code_sbs_display: obs.code.sbsDisplay,
        value_quantity: obs.value.value,
        value_unit: obs.value.unit,
        value_string: obs.value.stringValue,
        effective_date: obs.effectiveDateTime ? new Date(obs.effectiveDateTime) : null,
        source_system_id: obs.provenance?.sourceSystemId,
        source_record_id: obs.provenance?.sourceRecordId
      },
      create: {
        internal_id: obs.internalId,
        patient_id: obs.patientId,
        encounter_id: obs.encounterId,
        status: obs.status,
        code_source_code: obs.code.sourceCode,
        code_source_system: obs.code.sourceSystem,
        code_source_display: obs.code.sourceDisplay,
        code_loinc_code: obs.code.loincCode,
        code_loinc_display: obs.code.loincDisplay,
        code_sbs_code: obs.code.sbsCode,
        code_sbs_display: obs.code.sbsDisplay,
        value_quantity: obs.value.value,
        value_unit: obs.value.unit,
        value_string: obs.value.stringValue,
        effective_date: obs.effectiveDateTime ? new Date(obs.effectiveDateTime) : null,
        source_system_id: obs.provenance?.sourceSystemId,
        source_record_id: obs.provenance?.sourceRecordId
      }
    });
    return obs.internalId;
  }

  async getObservationsByPatient(patientId: string): Promise<CanonicalObservation[]> {
    const list = await this.prisma.observation.findMany({
      where: { patient_id: patientId },
      orderBy: { effective_date: 'desc' }
    });
    return list.map(o => this.mapObservationToCanonical(o));
  }

  async getAllObservations(): Promise<CanonicalObservation[]> {
    const list = await this.prisma.observation.findMany();
    return list.map(o => this.mapObservationToCanonical(o));
  }

  // COVERAGES
  private mapCoverageToCanonical(c: any): CanonicalCoverage {
    return {
      internalId: c.internal_id,
      patientId: c.patient_id,
      status: c.status,
      type: c.type,
      subscriberId: c.subscriber_id,
      beneficiaryId: c.beneficiary_id,
      payorId: c.payor_id,
      period: {
        start: c.period_start ? c.period_start.toISOString() : undefined,
        end: c.period_end ? c.period_end.toISOString() : undefined
      },
      provenance: { sourceSystemId: c.source_system_id, sourceRecordId: c.source_record_id }
    };
  }

  async saveCoverage(cov: CanonicalCoverage): Promise<string> {
    await this.prisma.coverage.upsert({
      where: { internal_id: cov.internalId },
      update: {
        patient_id: cov.patientId,
        status: cov.status,
        type: cov.type,
        subscriber_id: cov.subscriberId,
        beneficiary_id: cov.beneficiaryId,
        payor_id: cov.payorId,
        period_start: cov.period?.start ? new Date(cov.period.start) : null,
        period_end: cov.period?.end ? new Date(cov.period.end) : null,
        source_system_id: cov.provenance?.sourceSystemId,
        source_record_id: cov.provenance?.sourceRecordId
      },
      create: {
        internal_id: cov.internalId,
        patient_id: cov.patientId,
        status: cov.status,
        type: cov.type,
        subscriber_id: cov.subscriberId,
        beneficiary_id: cov.beneficiaryId,
        payor_id: cov.payorId,
        period_start: cov.period?.start ? new Date(cov.period.start) : null,
        period_end: cov.period?.end ? new Date(cov.period.end) : null,
        source_system_id: cov.provenance?.sourceSystemId,
        source_record_id: cov.provenance?.sourceRecordId
      }
    });
    return cov.internalId;
  }

  async getCoveragesByPatient(patientId: string): Promise<CanonicalCoverage[]> {
    const list = await this.prisma.coverage.findMany({ where: { patient_id: patientId } });
    return list.map(c => this.mapCoverageToCanonical(c));
  }

  async getAllCoverages(): Promise<CanonicalCoverage[]> {
    const list = await this.prisma.coverage.findMany();
    return list.map(c => this.mapCoverageToCanonical(c));
  }

  // CLAIMS & CLAIM RESPONSES
  private mapClaimToCanonical(c: any): CanonicalClaim {
    return {
      internalId: c.internal_id,
      patientId: c.patient_id,
      encounterId: c.encounter_id,
      coverageId: c.coverage_id,
      status: c.status,
      type: c.type,
      use: c.use,
      total: { value: c.total_value, currency: c.total_currency },
      submissionDate: c.submission_date ? c.submission_date.toISOString() : '',
      provenance: { sourceSystemId: c.source_system_id, sourceRecordId: c.source_record_id }
    };
  }

  async saveClaim(claim: CanonicalClaim): Promise<string> {
    await this.prisma.claim.upsert({
      where: { internal_id: claim.internalId },
      update: {
        patient_id: claim.patientId,
        encounter_id: claim.encounterId,
        coverage_id: claim.coverageId,
        status: claim.status,
        type: claim.type,
        use: claim.use,
        total_value: claim.total?.value,
        total_currency: claim.total?.currency,
        submission_date: claim.submissionDate ? new Date(claim.submissionDate) : null,
        source_system_id: claim.provenance?.sourceSystemId,
        source_record_id: claim.provenance?.sourceRecordId
      },
      create: {
        internal_id: claim.internalId,
        patient_id: claim.patientId,
        encounter_id: claim.encounterId,
        coverage_id: claim.coverageId,
        status: claim.status,
        type: claim.type,
        use: claim.use,
        total_value: claim.total?.value,
        total_currency: claim.total?.currency,
        submission_date: claim.submissionDate ? new Date(claim.submissionDate) : null,
        source_system_id: claim.provenance?.sourceSystemId,
        source_record_id: claim.provenance?.sourceRecordId
      }
    });
    return claim.internalId;
  }

  async getClaimsByPatient(patientId: string): Promise<CanonicalClaim[]> {
    const list = await this.prisma.claim.findMany({
      where: { patient_id: patientId },
      orderBy: { submission_date: 'desc' }
    });
    return list.map(c => this.mapClaimToCanonical(c));
  }

  async getAllClaims(): Promise<CanonicalClaim[]> {
    const list = await this.prisma.claim.findMany();
    return list.map(c => this.mapClaimToCanonical(c));
  }

  async saveClaimResponse(res: CanonicalClaimResponse): Promise<void> {
    await this.prisma.claimResponse.create({
      data: {
        claim_id: res.claimId,
        status: res.status,
        outcome: res.outcome,
        payment_value: res.payment?.value,
        payment_currency: res.payment?.currency
      }
    });
  }

  async getClaimResponse(claimId: string): Promise<CanonicalClaimResponse | null> {
    const cr = await this.prisma.claimResponse.findFirst({ where: { claim_id: claimId } });
    if (!cr) return null;
    return {
      claimId: cr.claim_id,
      status: cr.status as any,
      outcome: cr.outcome as any,
      payment: { value: cr.payment_value || 0, currency: cr.payment_currency || '' }
    };
  }

  // MEDICATIONS
  private mapMedicationToCanonical(m: any): CanonicalMedicationRequest {
    return {
      internalId: m.internal_id,
      patientId: m.patient_id,
      encounterId: m.encounter_id,
      status: m.status,
      intent: m.intent,
      medicationCode: {
        sourceCode: m.code_source_code,
        sourceSystem: m.code_source_system,
        sourceDisplay: m.code_source_display,
        sfdaCode: m.code_sfda_code,
        sfdaDisplay: m.code_sfda_display,
        rxnormCode: m.code_rxnorm_code,
        rxnormDisplay: m.code_rxnorm_display,
        atcCode: m.code_atc_code
      },
      dosageInstruction: [{ text: m.dosage_text }],
      authoredOn: m.authored_on ? m.authored_on.toISOString() : '',
      provenance: { sourceSystemId: m.source_system_id, sourceRecordId: m.source_record_id }
    };
  }

  async saveMedicationRequest(rx: CanonicalMedicationRequest): Promise<string> {
    await this.prisma.medicationRequest.upsert({
      where: { internal_id: rx.internalId },
      update: {
        patient_id: rx.patientId,
        encounter_id: rx.encounterId,
        status: rx.status,
        intent: rx.intent,
        code_source_code: rx.medicationCode.sourceCode,
        code_source_system: rx.medicationCode.sourceSystem,
        code_source_display: rx.medicationCode.sourceDisplay,
        code_sfda_code: rx.medicationCode.sfdaCode,
        code_sfda_display: rx.medicationCode.sfdaDisplay,
        code_rxnorm_code: rx.medicationCode.rxnormCode,
        code_rxnorm_display: rx.medicationCode.rxnormDisplay,
        code_atc_code: rx.medicationCode.atcCode,
        dosage_text: rx.dosageInstruction?.[0]?.text,
        authored_on: rx.authoredOn ? new Date(rx.authoredOn) : null,
        source_system_id: rx.provenance?.sourceSystemId,
        source_record_id: rx.provenance?.sourceRecordId
      },
      create: {
        internal_id: rx.internalId,
        patient_id: rx.patientId,
        encounter_id: rx.encounterId,
        status: rx.status,
        intent: rx.intent,
        code_source_code: rx.medicationCode.sourceCode,
        code_source_system: rx.medicationCode.sourceSystem,
        code_source_display: rx.medicationCode.sourceDisplay,
        code_sfda_code: rx.medicationCode.sfdaCode,
        code_sfda_display: rx.medicationCode.sfdaDisplay,
        code_rxnorm_code: rx.medicationCode.rxnormCode,
        code_rxnorm_display: rx.medicationCode.rxnormDisplay,
        code_atc_code: rx.medicationCode.atcCode,
        dosage_text: rx.dosageInstruction?.[0]?.text,
        authored_on: rx.authoredOn ? new Date(rx.authoredOn) : null,
        source_system_id: rx.provenance?.sourceSystemId,
        source_record_id: rx.provenance?.sourceRecordId
      }
    });
    return rx.internalId;
  }

  async getMedicationRequestsByPatient(patientId: string): Promise<CanonicalMedicationRequest[]> {
    const list = await this.prisma.medicationRequest.findMany({
      where: { patient_id: patientId },
      orderBy: { authored_on: 'desc' }
    });
    return list.map(m => this.mapMedicationToCanonical(m));
  }

  async getAllMedicationRequests(): Promise<CanonicalMedicationRequest[]> {
    const list = await this.prisma.medicationRequest.findMany();
    return list.map(m => this.mapMedicationToCanonical(m));
  }

  // IMMUNIZATIONS
  private mapImmunizationToCanonical(i: any): CanonicalImmunization {
    return {
      internalId: i.internal_id,
      patientId: i.patient_id,
      encounterId: i.encounter_id,
      status: i.status,
      vaccineCode: {
        sourceCode: i.code_source_code,
        sourceSystem: i.code_source_system,
        sourceDisplay: i.code_source_display,
        cvxCode: i.code_cvx_code,
        cvxDisplay: i.code_cvx_display
      },
      occurrenceDateTime: i.occurrence_date ? i.occurrence_date.toISOString() : '',
      provenance: { sourceSystemId: i.source_system_id, sourceRecordId: i.source_record_id }
    };
  }

  async saveImmunization(imm: CanonicalImmunization): Promise<string> {
    await this.prisma.immunization.upsert({
      where: { internal_id: imm.internalId },
      update: {
        patient_id: imm.patientId,
        encounter_id: imm.encounterId,
        status: imm.status,
        code_source_code: imm.vaccineCode.sourceCode,
        code_source_system: imm.vaccineCode.sourceSystem,
        code_source_display: imm.vaccineCode.sourceDisplay,
        code_cvx_code: imm.vaccineCode.cvxCode,
        code_cvx_display: imm.vaccineCode.cvxDisplay,
        occurrence_date: imm.occurrenceDateTime ? new Date(imm.occurrenceDateTime) : null,
        source_system_id: imm.provenance?.sourceSystemId,
        source_record_id: imm.provenance?.sourceRecordId
      },
      create: {
        internal_id: imm.internalId,
        patient_id: imm.patientId,
        encounter_id: imm.encounterId,
        status: imm.status,
        code_source_code: imm.vaccineCode.sourceCode,
        code_source_system: imm.vaccineCode.sourceSystem,
        code_source_display: imm.vaccineCode.sourceDisplay,
        code_cvx_code: imm.vaccineCode.cvxCode,
        code_cvx_display: imm.vaccineCode.cvxDisplay,
        occurrence_date: imm.occurrenceDateTime ? new Date(imm.occurrenceDateTime) : null,
        source_system_id: imm.provenance?.sourceSystemId,
        source_record_id: imm.provenance?.sourceRecordId
      }
    });
    return imm.internalId;
  }

  async getImmunizationsByPatient(patientId: string): Promise<CanonicalImmunization[]> {
    const list = await this.prisma.immunization.findMany({
      where: { patient_id: patientId },
      orderBy: { occurrence_date: 'desc' }
    });
    return list.map(i => this.mapImmunizationToCanonical(i));
  }

  async getAllImmunizations(): Promise<CanonicalImmunization[]> {
    const list = await this.prisma.immunization.findMany();
    return list.map(i => this.mapImmunizationToCanonical(i));
  }

  // ALLERGIES
  private mapAllergyToCanonical(a: any): CanonicalAllergyIntolerance {
    return {
      internalId: a.internal_id,
      patientId: a.patient_id,
      clinicalStatus: a.clinical_status,
      verificationStatus: a.verification_status,
      type: a.type,
      code: {
        sourceCode: a.code_source_code,
        sourceSystem: a.code_source_system,
        sourceDisplay: a.code_source_display,
        snomedCode: a.code_snomed_code,
        snomedDisplay: a.code_snomed_display
      },
      recordedDate: a.recorded_date ? a.recorded_date.toISOString() : undefined,
      provenance: { sourceSystemId: a.source_system_id, sourceRecordId: a.source_record_id }
    };
  }

  async saveAllergyIntolerance(alg: CanonicalAllergyIntolerance): Promise<string> {
    await this.prisma.allergyIntolerance.upsert({
      where: { internal_id: alg.internalId },
      update: {
        patient_id: alg.patientId,
        clinical_status: alg.clinicalStatus,
        verification_status: alg.verificationStatus,
        type: alg.type,
        code_source_code: alg.code.sourceCode,
        code_source_system: alg.code.sourceSystem,
        code_source_display: alg.code.sourceDisplay,
        code_snomed_code: alg.code.snomedCode,
        code_snomed_display: alg.code.snomedDisplay,
        recorded_date: alg.recordedDate ? new Date(alg.recordedDate) : null,
        source_system_id: alg.provenance?.sourceSystemId,
        source_record_id: alg.provenance?.sourceRecordId
      },
      create: {
        internal_id: alg.internalId,
        patient_id: alg.patientId,
        clinical_status: alg.clinicalStatus,
        verification_status: alg.verificationStatus,
        type: alg.type,
        code_source_code: alg.code.sourceCode,
        code_source_system: alg.code.sourceSystem,
        code_source_display: alg.code.sourceDisplay,
        code_snomed_code: alg.code.snomedCode,
        code_snomed_display: alg.code.snomedDisplay,
        recorded_date: alg.recordedDate ? new Date(alg.recordedDate) : null,
        source_system_id: alg.provenance?.sourceSystemId,
        source_record_id: alg.provenance?.sourceRecordId
      }
    });
    return alg.internalId;
  }

  async getAllergiesByPatient(patientId: string): Promise<CanonicalAllergyIntolerance[]> {
    const list = await this.prisma.allergyIntolerance.findMany({
      where: { patient_id: patientId },
      orderBy: { recorded_date: 'desc' }
    });
    return list.map(a => this.mapAllergyToCanonical(a));
  }

  async getAllAllergies(): Promise<CanonicalAllergyIntolerance[]> {
    const list = await this.prisma.allergyIntolerance.findMany();
    return list.map(a => this.mapAllergyToCanonical(a));
  }

  // DIAGNOSTIC REPORTS
  private mapDiagnosticReportToCanonical(d: any): CanonicalDiagnosticReport {
    return {
      internalId: d.internal_id,
      patientId: d.patient_id,
      encounterId: d.encounter_id,
      status: d.status,
      code: {
        sourceCode: d.code_source_code,
        sourceSystem: d.code_source_system,
        sourceDisplay: d.code_source_display,
        loincCode: d.code_loinc_code,
        loincDisplay: d.code_loinc_display
      },
      issued: d.issued ? d.issued.toISOString() : '',
      provenance: { sourceSystemId: d.source_system_id, sourceRecordId: d.source_record_id }
    };
  }

  async saveDiagnosticReport(rep: CanonicalDiagnosticReport): Promise<string> {
    await this.prisma.diagnosticReport.upsert({
      where: { internal_id: rep.internalId },
      update: {
        patient_id: rep.patientId,
        encounter_id: rep.encounterId,
        status: rep.status,
        code_source_code: rep.code.sourceCode,
        code_source_system: rep.code.sourceSystem,
        code_source_display: rep.code.sourceDisplay,
        code_loinc_code: rep.code.loincCode,
        code_loinc_display: rep.code.loincDisplay,
        issued: rep.issued ? new Date(rep.issued) : null,
        source_system_id: rep.provenance?.sourceSystemId,
        source_record_id: rep.provenance?.sourceRecordId
      },
      create: {
        internal_id: rep.internalId,
        patient_id: rep.patientId,
        encounter_id: rep.encounterId,
        status: rep.status,
        code_source_code: rep.code.sourceCode,
        code_source_system: rep.code.sourceSystem,
        code_source_display: rep.code.sourceDisplay,
        code_loinc_code: rep.code.loincCode,
        code_loinc_display: rep.code.loincDisplay,
        issued: rep.issued ? new Date(rep.issued) : null,
        source_system_id: rep.provenance?.sourceSystemId,
        source_record_id: rep.provenance?.sourceRecordId
      }
    });
    return rep.internalId;
  }

  async getDiagnosticReportsByPatient(patientId: string): Promise<CanonicalDiagnosticReport[]> {
    const list = await this.prisma.diagnosticReport.findMany({
      where: { patient_id: patientId },
      orderBy: { issued: 'desc' }
    });
    return list.map(d => this.mapDiagnosticReportToCanonical(d));
  }

  async getAllDiagnosticReports(): Promise<CanonicalDiagnosticReport[]> {
    const list = await this.prisma.diagnosticReport.findMany();
    return list.map(d => this.mapDiagnosticReportToCanonical(d));
  }

  // LONGITUDINAL RECORD
  async getLongitudinalRecord(patientId: string): Promise<LongitudinalRecord | null> {
    const patient = await this.getPatient(patientId);
    if (!patient) return null;

    const [encounters, conditions, observations, coverages, claims, medicationRequests, immunizations, allergies, diagnosticReports] = await Promise.all([
      this.getEncountersByPatient(patientId),
      this.getConditionsByPatient(patientId),
      this.getObservationsByPatient(patientId),
      this.getCoveragesByPatient(patientId),
      this.getClaimsByPatient(patientId),
      this.getMedicationRequestsByPatient(patientId),
      this.getImmunizationsByPatient(patientId),
      this.getAllergiesByPatient(patientId),
      this.getDiagnosticReportsByPatient(patientId)
    ]);

    return { patient, encounters, conditions, observations, coverages, claims, medicationRequests, immunizations, allergies, diagnosticReports };
  }

  // ORGANIZATIONS & PRACTITIONERS (Stubs for full API interface support, usually seeded/externally managed)
  async saveOrganization(org: CanonicalOrganization): Promise<void> {
    // Only implemented minimal fields for compatibility, real system uses Prisma Organization table directly
  }

  async savePractitioner(prac: CanonicalPractitioner): Promise<void> {
    // Stubs
  }

  async reassignPatientRecords(sourcePatientId: string, targetPatientId: string): Promise<any> {
    // In Prisma, we just execute updates on all dependent tables
    const results = await this.prisma.$transaction([
      this.prisma.encounter.updateMany({ where: { patient_id: sourcePatientId }, data: { patient_id: targetPatientId } }),
      this.prisma.condition.updateMany({ where: { patient_id: sourcePatientId }, data: { patient_id: targetPatientId } }),
      this.prisma.observation.updateMany({ where: { patient_id: sourcePatientId }, data: { patient_id: targetPatientId } }),
      this.prisma.medicationRequest.updateMany({ where: { patient_id: sourcePatientId }, data: { patient_id: targetPatientId } }),
      this.prisma.immunization.updateMany({ where: { patient_id: sourcePatientId }, data: { patient_id: targetPatientId } }),
      this.prisma.allergyIntolerance.updateMany({ where: { patient_id: sourcePatientId }, data: { patient_id: targetPatientId } }),
      this.prisma.diagnosticReport.updateMany({ where: { patient_id: sourcePatientId }, data: { patient_id: targetPatientId } }),
      this.prisma.coverage.updateMany({ where: { patient_id: sourcePatientId }, data: { patient_id: targetPatientId } }),
      this.prisma.claim.updateMany({ where: { patient_id: sourcePatientId }, data: { patient_id: targetPatientId } })
    ]);

    return {
      encountersUpdated: results[0].count,
      conditionsUpdated: results[1].count,
      observationsUpdated: results[2].count,
      medicationsUpdated: results[3].count,
      immunizationsUpdated: results[4].count,
      allergiesUpdated: results[5].count,
      diagnosticReportsUpdated: results[6].count,
      coveragesUpdated: results[7].count,
      claimsUpdated: results[8].count
    };
  }

  async clearAll(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.patientIdentifier.deleteMany(),
      this.prisma.condition.deleteMany(),
      this.prisma.observation.deleteMany(),
      this.prisma.medicationRequest.deleteMany(),
      this.prisma.immunization.deleteMany(),
      this.prisma.allergyIntolerance.deleteMany(),
      this.prisma.diagnosticReport.deleteMany(),
      this.prisma.claimResponse.deleteMany(),
      this.prisma.claim.deleteMany(),
      this.prisma.coverage.deleteMany(),
      this.prisma.encounter.deleteMany(),
      this.prisma.patient.deleteMany()
    ]);
  }
}
