import { prisma as defaultPrisma } from '../lib/prisma.js';
import type { PrismaClient } from '@prisma/client';
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
import type { LongitudinalRecord } from '../core/domain/longitudinal-record.js';
import type { ICanonicalStore } from './canonical-store.interface.js';

const searchCache = new Map<string, { data: any; ts: number }>();
const SEARCH_CACHE_TTL = 30 * 1000;
const SEARCH_CACHE_MAX = 500;

export type { LongitudinalRecord };

export class PrismaCanonicalStore implements ICanonicalStore {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || defaultPrisma as unknown as PrismaClient;
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
          internal_id_uuid: (patient as any).internalIdUuid || undefined,
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
      identifiers: p.identifiers ? p.identifiers.map((i: any) => ({
        value: i.value,
        type: i.type,
        system: i.system,
        sourceSystemId: i.source_system_id,
        firstSeenAt: i.first_seen_at ? i.first_seen_at.toISOString() : new Date().toISOString(),
        isActive: i.is_active ?? true
      })) : [],
      givenName: p.first_name || '',
      familyName: p.last_name || '',
      givenNameAr: p.first_name_ar || undefined,
      familyNameAr: p.last_name_ar || undefined,
      phone: p.phone || undefined,
      email: p.email || undefined,
      gender: p.gender,
      birthDate: p.birth_date ? p.birth_date.toISOString().split('T')[0] : '',
      createdAt: p.created_at ? p.created_at.toISOString() : new Date().toISOString(),
      updatedAt: p.updated_at ? p.updated_at.toISOString() : new Date().toISOString(),
      provenance: {
        sourceSystemId: p.source_system_id || 'UNKNOWN',
        sourceRecordId: p.source_record_id || p.internal_id,
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
    } as any;
  }

  async getPatient(internalId: string): Promise<CanonicalPatient | null> {
    let p: any = null;
    try { p = await this.prisma.patient.findUnique({ where: { internal_id_uuid: internalId } as any, include: { identifiers: true } }); } catch {}
    if (!p) p = await this.prisma.patient.findUnique({ where: { internal_id: internalId }, include: { identifiers: true } });
    if (!p) {
      p = await this.prisma.patient.findFirst({
        where: { id: internalId },
        include: { identifiers: true }
      });
    }
    if (!p) {
      const byIden = await this.findPatientByIdentifier(internalId);
      if (byIden) return byIden;
    }
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

  async searchPatients(params: { q?: string; skip?: number; take?: number; sort?: string; organizationId?: string; cursor?: string }): Promise<{ items: CanonicalPatient[]; total: number; nextCursor?: string|null }> {
    const q = (params.q || '').trim();
    const take = Math.min(Math.max(params.take || 20, 1), 50);
    const skip = (params as any).cursor ? 0 : Math.min(Math.max(params.skip || 0, 0), 10000);
    const hasQuery = q.length >= 2;
    const cacheKey = `${q}|${skip}|${take}|${params.sort||'recent'}|${(params as any).organizationId||''}|${(params as any).cursor||''}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL) return cached.data as any;
    let where: any = {};
    if (hasQuery) {
      const isNumeric = /^[0-9]+$/.test(q);
      if (isNumeric && q.length >= 6) {
        where = {
          OR: [
            { internal_id: { contains: q } },
            { identifiers: { some: { value: { contains: q } } } },
            { phone: { contains: q } }
          ]
        };
      } else {
        where = {
          OR: [
            { internal_id: { contains: q, mode: 'insensitive' } },
            { first_name: { contains: q, mode: 'insensitive' } },
            { last_name: { contains: q, mode: 'insensitive' } },
            { first_name_ar: { contains: q, mode: 'insensitive' } },
            { last_name_ar: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { identifiers: { some: { value: { contains: q } } } }
          ]
        };
      }
      }
      if ((params as any).organizationId) {
        const orgId = (params as any).organizationId;
        const orgFilter: any = { OR: [{ source_system_id: orgId }, { organizations: { some: { organization_id: orgId, active: true } } }] };
        if (Object.keys(where).length === 0) where = orgFilter;
        else where = { AND: [where, orgFilter] };
      }
      if ((params as any).cursor) {
        try {
          const decoded = JSON.parse(Buffer.from((params as any).cursor, 'base64').toString('utf8'));
          const cursorWhere: any = { OR: [{ created_at: { lt: new Date(decoded.created_at) } }, { created_at: decoded.created_at, id: { lt: decoded.id } }] };
          where = Object.keys(where).length ? { AND: [where, cursorWhere] } : cursorWhere;
        } catch {}
      }
    const orderBy: any = params.sort === 'name' ? [{ first_name_ar: 'asc' }, { first_name: 'asc' }] : [{ created_at: 'desc' }, { id: 'desc' }];
    const fetchTake = (params as any).cursor ? take + 1 : take;
    const [total, rowsAll] = await Promise.all([
      (params as any).cursor ? Promise.resolve(0) : this.prisma.patient.count({ where }),
      this.prisma.patient.findMany({ where, include: { identifiers: true }, orderBy, skip: (params as any).cursor ? 0 : skip, take: fetchTake })
    ]);
    const hasMore = rowsAll.length > take;
    const rows = hasMore ? rowsAll.slice(0, take) : rowsAll;
    const nextCursor = hasMore ? Buffer.from(JSON.stringify({ created_at: rows[rows.length-1].created_at, id: rows[rows.length-1].id })).toString('base64') : null;
    const result: any = { items: rows.map(p => this.mapPatientToCanonical(p)), total: (params as any).cursor ? rows.length : total, nextCursor, hasMore };
    searchCache.set(cacheKey, { data: result, ts: Date.now() });
    if (searchCache.size > SEARCH_CACHE_MAX) searchCache.delete(searchCache.keys().next().value);
    return result;
  }

  async countPatients(): Promise<number> {
    return this.prisma.patient.count();
  }

  // ENCOUNTER
  private mapEncounterToCanonical(e: any): CanonicalEncounter {
    return {
      internalId: e.internal_id,
      patientId: e.patient_id,
      status: e.status || 'finished',
      class: e.encounter_class || 'outpatient',
      period: {
        start: e.period_start ? e.period_start.toISOString() : '',
        end: e.period_end ? e.period_end.toISOString() : undefined
      },
      sourceVisitId: e.source_visit_id,
      createdAt: e.created_at ? e.created_at.toISOString() : new Date().toISOString(),
      provenance: {
        rawRecordId: e.id || e.internal_id,
        adapterVersion: '1.0',
        mappingVersion: '1.0',
        terminologyMapVersion: '1.0',
        sourceSystemId: e.source_system_id || 'UNKNOWN',
        sourceRecordId: e.source_record_id || e.internal_id,
        ingestedAt: new Date().toISOString(),
        transformedAt: new Date().toISOString(),
        persistedAt: new Date().toISOString(),
        validationScore: 100,
        validationDecision: 'ACCEPTED'
      }
    } as any;
  }

  async saveEncounter(enc: CanonicalEncounter): Promise<string> {
    const encClass = typeof enc.class === 'string' ? enc.class : (enc.class as any)?.code || 'outpatient';
    let patientUuid: string | null = null;
    try { const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: enc.patientId }, { internal_id_uuid: enc.patientId } as any, { id: enc.patientId }] } }); if (pat) patientUuid = (pat as any).id; } catch {}
    await this.prisma.encounter.upsert({
      where: { internal_id: enc.internalId },
      update: {
        patient_id: enc.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        status: enc.status,
        encounter_class: encClass,
        period_start: enc.period?.start ? new Date(enc.period.start) : null,
        period_end: enc.period?.end ? new Date(enc.period.end) : null,
        source_visit_id: enc.sourceVisitId,
        source_system_id: enc.provenance?.sourceSystemId,
        source_record_id: enc.provenance?.sourceRecordId
      },
      create: {
        internal_id: enc.internalId,
        patient_id: enc.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        status: enc.status,
        encounter_class: encClass,
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
      createdAt: c.created_at ? c.created_at.toISOString() : new Date().toISOString(),
      provenance: {
        rawRecordId: c.id || c.internal_id,
        adapterVersion: '1.0',
        mappingVersion: '1.0',
        terminologyMapVersion: '1.0',
        sourceSystemId: c.source_system_id || 'UNKNOWN',
        sourceRecordId: c.source_record_id || c.internal_id,
        ingestedAt: new Date().toISOString(),
        transformedAt: new Date().toISOString(),
        persistedAt: new Date().toISOString(),
        validationScore: 100,
        validationDecision: 'ACCEPTED'
      }
    } as any;
  }

  async saveCondition(cond: CanonicalCondition): Promise<string> {
        let patientUuid: string | null = null;
    try { const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: (arguments[0] as any).patientId }, { internal_id_uuid: (arguments[0] as any).patientId } as any, { id: (arguments[0] as any).patientId }] } }); if (pat) patientUuid = (pat as any).id; } catch {}
    await this.prisma.condition.upsert({
      where: { internal_id: cond.internalId },
      update: {
        patient_id: cond.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
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
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
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
      valueQuantity: o.value_quantity ? { value: o.value_quantity, unit: o.value_unit || '' } : undefined,
      valueString: o.value_string || undefined,
      effectiveDateTime: o.effective_date ? o.effective_date.toISOString() : '',
      createdAt: o.created_at ? o.created_at.toISOString() : new Date().toISOString(),
      provenance: {
        rawRecordId: o.id || o.internal_id,
        adapterVersion: '1.0',
        mappingVersion: '1.0',
        terminologyMapVersion: '1.0',
        sourceSystemId: o.source_system_id || 'UNKNOWN',
        sourceRecordId: o.source_record_id || o.internal_id,
        ingestedAt: new Date().toISOString(),
        transformedAt: new Date().toISOString(),
        persistedAt: new Date().toISOString(),
        validationScore: 100,
        validationDecision: 'ACCEPTED'
      }
    } as any;
  }

  async saveObservation(obs: CanonicalObservation): Promise<string> {
    const valQty = (obs as any).valueQuantity?.value ?? (obs as any).value?.value;
    const valUnit = (obs as any).valueQuantity?.unit ?? (obs as any).value?.unit;
    const valStr = (obs as any).valueString ?? (obs as any).value?.stringValue;

        let patientUuid: string | null = null;
    try { const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: (arguments[0] as any).patientId }, { internal_id_uuid: (arguments[0] as any).patientId } as any, { id: (arguments[0] as any).patientId }] } }); if (pat) patientUuid = (pat as any).id; } catch {}
    await this.prisma.observation.upsert({
      where: { internal_id: obs.internalId },
      update: {
        patient_id: obs.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        encounter_id: obs.encounterId,
        status: obs.status,
        code_source_code: obs.code.sourceCode,
        code_source_system: obs.code.sourceSystem,
        code_source_display: obs.code.sourceDisplay,
        code_loinc_code: obs.code.loincCode,
        code_loinc_display: obs.code.loincDisplay,
        code_sbs_code: obs.code.sbsCode,
        code_sbs_display: obs.code.sbsDisplay,
        value_quantity: valQty,
        value_unit: valUnit,
        value_string: valStr,
        effective_date: obs.effectiveDateTime ? new Date(obs.effectiveDateTime) : null,
        source_system_id: obs.provenance?.sourceSystemId,
        source_record_id: obs.provenance?.sourceRecordId
      },
      create: {
        internal_id: obs.internalId,
        patient_id: obs.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        encounter_id: obs.encounterId,
        status: obs.status,
        code_source_code: obs.code.sourceCode,
        code_source_system: obs.code.sourceSystem,
        code_source_display: obs.code.sourceDisplay,
        code_loinc_code: obs.code.loincCode,
        code_loinc_display: obs.code.loincDisplay,
        code_sbs_code: obs.code.sbsCode,
        code_sbs_display: obs.code.sbsDisplay,
        value_quantity: valQty,
        value_unit: valUnit,
        value_string: valStr,
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
      payerId: c.payor_id || 'INS-CHI-101',
      payerName: 'Tawuniya Insurance',
      payerNameAr: 'شركة التعاونية للتأمين',
      policyNumber: c.subscriber_id || 'POL-992211',
      memberId: c.beneficiary_id || 'MEM-112233',
      networkClass: 'Class A',
      copayPercentage: 20,
      copayMaxCapSAR: 100,
      annualMaxLimitSAR: 500000,
      status: c.status || 'active',
      period: {
        start: c.period_start ? c.period_start.toISOString() : '2026-01-01',
        end: c.period_end ? c.period_end.toISOString() : '2026-12-31'
      },
      createdAt: c.created_at ? c.created_at.toISOString() : new Date().toISOString(),
      provenance: {
        rawRecordId: c.id || c.internal_id,
        adapterVersion: '1.0',
        mappingVersion: '1.0',
        terminologyMapVersion: '1.0',
        sourceSystemId: c.source_system_id || 'UNKNOWN',
        sourceRecordId: c.source_record_id || c.internal_id,
        ingestedAt: new Date().toISOString(),
        transformedAt: new Date().toISOString(),
        persistedAt: new Date().toISOString(),
        validationScore: 100,
        validationDecision: 'ACCEPTED'
      }
    } as any;
  }

  async saveCoverage(cov: CanonicalCoverage): Promise<string> {
    const payor = (cov as any).payerId || (cov as any).payorId || 'INS-CHI-101';
    const subId = (cov as any).policyNumber || (cov as any).subscriberId || 'POL-001';
    const benId = (cov as any).memberId || (cov as any).beneficiaryId || 'MEM-001';

        let patientUuid: string | null = null;
    try { const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: (arguments[0] as any).patientId }, { internal_id_uuid: (arguments[0] as any).patientId } as any, { id: (arguments[0] as any).patientId }] } }); if (pat) patientUuid = (pat as any).id; } catch {}
    await this.prisma.coverage.upsert({
      where: { internal_id: cov.internalId },
      update: {
        patient_id: cov.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        status: cov.status,
        type: 'health',
        subscriber_id: subId,
        beneficiary_id: benId,
        payor_id: payor,
        period_start: cov.period?.start ? new Date(cov.period.start) : null,
        period_end: cov.period?.end ? new Date(cov.period.end) : null,
        source_system_id: cov.provenance?.sourceSystemId,
        source_record_id: cov.provenance?.sourceRecordId
      },
      create: {
        internal_id: cov.internalId,
        patient_id: cov.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        status: cov.status,
        type: 'health',
        subscriber_id: subId,
        beneficiary_id: benId,
        payor_id: payor,
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
      serviceProviderId: c.source_system_id || 'UNKNOWN',
      claimType: c.type || 'institutional',
      subType: 'outpatient',
      status: c.status || 'submitted',
      use: c.use || 'claim',
      totalGrossSAR: c.total_value || 0,
      totalPatientCopaySAR: 0,
      totalInsurerClaimedSAR: c.total_value || 0,
      diagnoses: [],
      items: [],
      submissionDate: c.submission_date ? c.submission_date.toISOString() : '',
      createdAt: c.created_at ? c.created_at.toISOString() : new Date().toISOString(),
      provenance: {
        rawRecordId: c.id || c.internal_id,
        adapterVersion: '1.0',
        mappingVersion: '1.0',
        terminologyMapVersion: '1.0',
        sourceSystemId: c.source_system_id || 'UNKNOWN',
        sourceRecordId: c.source_record_id || c.internal_id,
        ingestedAt: new Date().toISOString(),
        transformedAt: new Date().toISOString(),
        persistedAt: new Date().toISOString(),
        validationScore: 100,
        validationDecision: 'ACCEPTED'
      }
    } as any;
  }

  async saveClaim(claim: CanonicalClaim): Promise<string> {
    const totalGross = (claim as any).totalGrossSAR ?? (claim as any).total?.value ?? 0;
    const claimType = (claim as any).claimType ?? (claim as any).type ?? 'institutional';
        let patientUuid: string | null = null;
    try { const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: (arguments[0] as any).patientId }, { internal_id_uuid: (arguments[0] as any).patientId } as any, { id: (arguments[0] as any).patientId }] } }); if (pat) patientUuid = (pat as any).id; } catch {}
    await this.prisma.claim.upsert({
      where: { internal_id: claim.internalId },
      update: {
        patient_id: claim.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        encounter_id: claim.encounterId,
        coverage_id: claim.coverageId,
        status: claim.status,
        type: claimType,
        use: claim.use,
        total_value: totalGross,
        total_currency: 'SAR',
        submission_date: claim.submissionDate ? new Date(claim.submissionDate) : null,
        source_system_id: claim.provenance?.sourceSystemId,
        source_record_id: claim.provenance?.sourceRecordId
      },
      create: {
        internal_id: claim.internalId,
        patient_id: claim.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        encounter_id: claim.encounterId,
        coverage_id: claim.coverageId,
        status: claim.status,
        type: claimType,
        use: claim.use,
        total_value: totalGross,
        total_currency: 'SAR',
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
        status: (res as any).status || (res as any).outcome || 'complete',
        outcome: res.outcome,
        payment_value: (res as any).payment?.value ?? res.totalApprovedSAR ?? 0,
        payment_currency: (res as any).payment?.currency ?? 'SAR'
      }
    });
  }

  async getClaimResponse(claimId: string): Promise<CanonicalClaimResponse | null> {
    const cr = await this.prisma.claimResponse.findFirst({ where: { claim_id: claimId } });
    if (!cr) return null;
    return {
      internalId: cr.id,
      claimId: cr.claim_id,
      patientId: '',
      coverageId: '',
      outcome: (cr.outcome as any) || 'complete',
      disposition: 'Approved',
      totalApprovedSAR: cr.payment_value || 0,
      totalPatientCopaySAR: 0,
      totalPayerPayableSAR: cr.payment_value || 0,
      itemAdjudications: [],
      adjudicatedAt: cr.created_at.toISOString(),
      nphiesTransactionId: cr.id
    };
  }

  // MEDICATIONS
  private mapMedicationToCanonical(m: any): CanonicalMedicationRequest {
    return {
      internalId: m.internal_id,
      patientId: m.patient_id,
      encounterId: m.encounter_id,
      status: m.status || 'active',
      intent: m.intent || 'order',
      medication: {
        internalId: m.id || m.internal_id,
        status: 'active',
        form: 'Oral Tablet',
        strength: '500 mg',
        code: {
          sourceCode: m.code_source_code,
          sourceSystem: m.code_source_system,
          sourceDisplay: m.code_source_display,
          sfdaCode: m.code_sfda_code,
          sfdaDisplay: m.code_sfda_display,
          rxnormCode: m.code_rxnorm_code,
          atcCode: m.code_atc_code
        }
      },
      dosageInstruction: [{
        text: m.dosage_text || '',
        timing: { frequency: 2, period: 1, periodUnit: 'd' },
        route: 'Oral',
        doseQuantity: { value: 1, unit: 'TAB' }
      }],
      authoredOn: m.authored_on ? m.authored_on.toISOString() : '',
      createdAt: m.created_at ? m.created_at.toISOString() : new Date().toISOString(),
      provenance: {
        rawRecordId: m.id || m.internal_id,
        adapterVersion: '1.0',
        mappingVersion: '1.0',
        terminologyMapVersion: '1.0',
        sourceSystemId: m.source_system_id || 'UNKNOWN',
        sourceRecordId: m.source_record_id || m.internal_id,
        ingestedAt: m.created_at ? m.created_at.toISOString() : new Date().toISOString(),
        transformedAt: new Date().toISOString(),
        persistedAt: new Date().toISOString(),
        validationScore: 100,
        validationDecision: 'ACCEPTED'
      }
    } as any;
  }

  async saveMedicationRequest(rx: CanonicalMedicationRequest): Promise<string> {
    const medCode = (rx as any).medication?.code || (rx as any).medicationCode || {};
        let patientUuid: string | null = null;
    try { const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: (arguments[0] as any).patientId }, { internal_id_uuid: (arguments[0] as any).patientId } as any, { id: (arguments[0] as any).patientId }] } }); if (pat) patientUuid = (pat as any).id; } catch {}
    await this.prisma.medicationRequest.upsert({
      where: { internal_id: rx.internalId },
      update: {
        patient_id: rx.patientId,
        encounter_id: rx.encounterId,
        status: rx.status,
        intent: rx.intent,
        code_source_code: medCode.sourceCode,
        code_source_system: medCode.sourceSystem,
        code_source_display: medCode.sourceDisplay,
        code_sfda_code: medCode.sfdaCode,
        code_sfda_display: medCode.sfdaDisplay,
        code_rxnorm_code: medCode.rxnormCode,
        code_rxnorm_display: medCode.rxnormDisplay,
        code_atc_code: medCode.atcCode,
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
        code_source_code: medCode.sourceCode,
        code_source_system: medCode.sourceSystem,
        code_source_display: medCode.sourceDisplay,
        code_sfda_code: medCode.sfdaCode,
        code_sfda_display: medCode.sfdaDisplay,
        code_rxnorm_code: medCode.rxnormCode,
        code_rxnorm_display: medCode.rxnormDisplay,
        code_atc_code: medCode.atcCode,
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
      status: i.status || 'completed',
      vaccineCode: {
        sourceCode: i.code_source_code,
        sourceSystem: i.code_source_system,
        sourceDisplay: i.code_source_display,
        cvxCode: i.code_cvx_code
      },
      occurrenceDateTime: i.occurrence_date ? i.occurrence_date.toISOString() : '',
      lotNumber: 'LOT-SA-2026',
      expirationDate: '2028-12-31',
      site: 'Left Deltoid',
      createdAt: i.created_at ? i.created_at.toISOString() : new Date().toISOString(),
      provenance: {
        rawRecordId: i.id || i.internal_id,
        adapterVersion: '1.0',
        mappingVersion: '1.0',
        terminologyMapVersion: '1.0',
        sourceSystemId: i.source_system_id || 'UNKNOWN',
        sourceRecordId: i.source_record_id || i.internal_id,
        ingestedAt: i.created_at ? i.created_at.toISOString() : new Date().toISOString(),
        transformedAt: new Date().toISOString(),
        persistedAt: new Date().toISOString(),
        validationScore: 100,
        validationDecision: 'ACCEPTED'
      }
    } as any;
  }

  async saveImmunization(imm: CanonicalImmunization): Promise<string> {
    const vaxCode: any = imm.vaccineCode || {};
        let patientUuid: string | null = null;
    try { const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: (arguments[0] as any).patientId }, { internal_id_uuid: (arguments[0] as any).patientId } as any, { id: (arguments[0] as any).patientId }] } }); if (pat) patientUuid = (pat as any).id; } catch {}
    await this.prisma.immunization.upsert({
      where: { internal_id: imm.internalId },
      update: {
        patient_id: imm.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        encounter_id: imm.encounterId,
        status: imm.status,
        code_source_code: vaxCode.sourceCode,
        code_source_system: vaxCode.sourceSystem,
        code_source_display: vaxCode.sourceDisplay,
        code_cvx_code: vaxCode.cvxCode,
        occurrence_date: imm.occurrenceDateTime ? new Date(imm.occurrenceDateTime) : null,
        source_system_id: imm.provenance?.sourceSystemId,
        source_record_id: imm.provenance?.sourceRecordId
      },
      create: {
        internal_id: imm.internalId,
        patient_id: imm.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        encounter_id: imm.encounterId,
        status: imm.status,
        code_source_code: vaxCode.sourceCode,
        code_source_system: vaxCode.sourceSystem,
        code_source_display: vaxCode.sourceDisplay,
        code_cvx_code: vaxCode.cvxCode,
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
      clinicalStatus: a.clinical_status || 'active',
      verificationStatus: a.verification_status || 'confirmed',
      type: a.type || 'allergy',
      category: 'medication',
      criticality: 'high',
      substanceText: a.code_source_display || '',
      substanceCode: {
        sourceCode: a.code_source_code,
        sourceSystem: a.code_source_system,
        sourceDisplay: a.code_source_display,
        snomedCode: a.code_snomed_code,
        snomedDisplay: a.code_snomed_display
      },
      reactions: [],
      recordedDate: a.recorded_date ? a.recorded_date.toISOString() : undefined,
      provenance: {
        rawRecordId: a.id || a.internal_id,
        adapterVersion: '1.0',
        mappingVersion: '1.0',
        terminologyMapVersion: '1.0',
        sourceSystemId: a.source_system_id || 'UNKNOWN',
        sourceRecordId: a.source_record_id || a.internal_id,
        ingestedAt: a.created_at ? a.created_at.toISOString() : new Date().toISOString(),
        transformedAt: new Date().toISOString(),
        persistedAt: new Date().toISOString(),
        validationScore: 100,
        validationDecision: 'ACCEPTED'
      }
    } as any;
  }

  async saveAllergyIntolerance(alg: CanonicalAllergyIntolerance): Promise<string> {
    const algCode = (alg as any).substanceCode || (alg as any).code || {};
        let patientUuid: string | null = null;
    try { const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: (arguments[0] as any).patientId }, { internal_id_uuid: (arguments[0] as any).patientId } as any, { id: (arguments[0] as any).patientId }] } }); if (pat) patientUuid = (pat as any).id; } catch {}
    await this.prisma.allergyIntolerance.upsert({
      where: { internal_id: alg.internalId },
      update: {
        patient_id: alg.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        clinical_status: alg.clinicalStatus,
        verification_status: alg.verificationStatus,
        type: alg.type,
        code_source_code: algCode.sourceCode,
        code_source_system: algCode.sourceSystem,
        code_source_display: algCode.sourceDisplay,
        code_snomed_code: algCode.snomedCode,
        code_snomed_display: algCode.snomedDisplay,
        recorded_date: alg.recordedDate ? new Date(alg.recordedDate) : null,
        source_system_id: alg.provenance?.sourceSystemId,
        source_record_id: alg.provenance?.sourceRecordId
      },
      create: {
        internal_id: alg.internalId,
        patient_id: alg.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
        clinical_status: alg.clinicalStatus,
        verification_status: alg.verificationStatus,
        type: alg.type,
        code_source_code: algCode.sourceCode,
        code_source_system: algCode.sourceSystem,
        code_source_display: algCode.sourceDisplay,
        code_snomed_code: algCode.snomedCode,
        code_snomed_display: algCode.snomedDisplay,
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
      provenance: {
        rawRecordId: d.id || d.internal_id,
        adapterVersion: '1.0',
        mappingVersion: '1.0',
        terminologyMapVersion: '1.0',
        sourceSystemId: d.source_system_id || 'UNKNOWN',
        sourceRecordId: d.source_record_id || d.internal_id,
        ingestedAt: new Date().toISOString(),
        transformedAt: new Date().toISOString(),
        persistedAt: new Date().toISOString(),
        validationScore: 100,
        validationDecision: 'ACCEPTED'
      }
    } as any;
  }

  async saveDiagnosticReport(rep: CanonicalDiagnosticReport): Promise<string> {
        let patientUuid: string | null = null;
    try { const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: (arguments[0] as any).patientId }, { internal_id_uuid: (arguments[0] as any).patientId } as any, { id: (arguments[0] as any).patientId }] } }); if (pat) patientUuid = (pat as any).id; } catch {}
    await this.prisma.diagnosticReport.upsert({
      where: { internal_id: rep.internalId },
      update: {
        patient_id: rep.patientId,
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
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
        ...(patientUuid ? { patient_id_uuid: patientUuid } as any : {}),
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
