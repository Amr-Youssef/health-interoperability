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

import fs from 'fs';
import path from 'path';

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

export class CanonicalStore {
  private persistPath: string;
  private patients: Map<string, CanonicalPatient> = new Map();
  private encounters: Map<string, CanonicalEncounter> = new Map();
  private conditions: Map<string, CanonicalCondition> = new Map();
  private observations: Map<string, CanonicalObservation> = new Map();
  private organizations: Map<string, CanonicalOrganization> = new Map();
  private practitioners: Map<string, CanonicalPractitioner> = new Map();
  
  // Financial stores
  private coverages: Map<string, CanonicalCoverage> = new Map();
  private claims: Map<string, CanonicalClaim> = new Map();
  private claimResponses: Map<string, CanonicalClaimResponse> = new Map();

  // Medication, Immunization, Allergy & Diagnostics stores
  private medicationRequests: Map<string, CanonicalMedicationRequest> = new Map();
  private immunizations: Map<string, CanonicalImmunization> = new Map();
  private allergies: Map<string, CanonicalAllergyIntolerance> = new Map();
  private diagnosticReports: Map<string, CanonicalDiagnosticReport> = new Map();

  constructor(persistPath?: string | null) {
    if (persistPath === null) {
      this.persistPath = '';
    } else {
      this.persistPath = persistPath || path.resolve(process.cwd(), '.data', 'canonical-store.json');
      this.loadFromDisk();
    }
  }

  /**
   * Builds the explicit idempotency key for a canonical entity.
   * Composite key = sourceSystemId + sourceRecordId + entityType.
   * Returns null when the reference is incomplete (such records are never
   * deduplicated or upserted by source — they are always treated as new).
   */
  private buildSourceKey(entityType: string, sourceSystemId?: string, sourceRecordId?: string): string | null {
    if (!sourceSystemId || !sourceRecordId) return null;
    return `${entityType}::${sourceSystemId}::${sourceRecordId}`;
  }

  private findExistingIdBySource<T extends { internalId: string; provenance?: { sourceSystemId?: string; sourceRecordId?: string } }>(
    store: Map<string, T>,
    entityType: string,
    sourceSystemId?: string,
    sourceRecordId?: string
  ): string | null {
    const targetKey = this.buildSourceKey(entityType, sourceSystemId, sourceRecordId);
    if (!targetKey) return null;
    for (const [id, entity] of store) {
      const entityKey = this.buildSourceKey(entityType, entity.provenance?.sourceSystemId, entity.provenance?.sourceRecordId);
      if (entityKey === targetKey) return id;
    }
    return null;
  }

  /**
   * Idempotent upsert keyed on the composite (sourceSystemId + sourceRecordId +
   * entityType). On collision the existing entity is overwritten with the newly
   * received payload while preserving its original internalId and createdAt.
   */
  private upsertBySource<T extends { internalId: string; provenance?: { sourceSystemId?: string; sourceRecordId?: string }; createdAt?: string }>(
    store: Map<string, T>,
    entityType: string,
    entity: T
  ): string {
    const existingId = this.findExistingIdBySource(
      store,
      entityType,
      entity.provenance?.sourceSystemId,
      entity.provenance?.sourceRecordId
    );

    if (!existingId) {
      store.set(entity.internalId, { ...entity });
      return entity.internalId;
    }

    const existing = store.get(existingId);
    const merged = {
      ...entity,
      internalId: existingId,
      createdAt: existing?.createdAt || entity.createdAt
    };
    store.set(existingId, merged as T);
    return existingId;
  }

  /**
   * Collapses duplicate legacy entities that share the same composite source key.
   * Keeps the first-loaded survivor and records a remap (dropped id -> survivor id)
   * so downstream references can be rewritten during disk load.
   */
  private dedupeByCompositeKey<T extends { internalId: string; provenance?: { sourceSystemId?: string; sourceRecordId?: string } }>(
    list: any[],
    entityType: string
  ): { items: T[]; remap: Map<string, string> } {
    const items: T[] = [];
    const seen: Map<string, string> = new Map();
    const remap: Map<string, string> = new Map();

    if (!Array.isArray(list)) return { items: [], remap };

    for (const item of list) {
      const key = this.buildSourceKey(entityType, item.provenance?.sourceSystemId, item.provenance?.sourceRecordId);
      if (!key) {
        items.push(item as T);
        continue;
      }
      const survivorId = seen.get(key);
      if (survivorId) {
        remap.set(item.internalId, survivorId);
        continue;
      }
      seen.set(key, item.internalId);
      items.push(item as T);
    }
    return { items, remap };
  }

  /**
   * Persist canonical store data to disk
   */
  private saveToDisk(): void {
    if (!this.persistPath) return;
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const snapshot = {
        patients: Array.from(this.patients.values()),
        encounters: Array.from(this.encounters.values()),
        conditions: Array.from(this.conditions.values()),
        observations: Array.from(this.observations.values()),
        organizations: Array.from(this.organizations.values()),
        practitioners: Array.from(this.practitioners.values()),
        coverages: Array.from(this.coverages.values()),
        claims: Array.from(this.claims.values()),
        claimResponses: Array.from(this.claimResponses.values()),
        medicationRequests: Array.from(this.medicationRequests.values()),
        immunizations: Array.from(this.immunizations.values()),
        allergies: Array.from(this.allergies.values()),
        diagnosticReports: Array.from(this.diagnosticReports.values()),
        savedAt: new Date().toISOString()
      };

      fs.writeFileSync(this.persistPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('⚠️ CanonicalStore disk persistence warning:', err.message);
    }
  }

  /**
   * Load canonical store data from disk
   */
  private loadFromDisk(): void {
    if (!this.persistPath) return;
    try {
      if (!fs.existsSync(this.persistPath)) return;
      const raw = fs.readFileSync(this.persistPath, 'utf-8');
      const data = JSON.parse(raw);

      // Load-time dedupe: legacy snapshots contain rows duplicated across
      // pipeline runs. Entries sharing the same composite source key
      // (entityType::sourceSystemId::sourceRecordId) are collapsed to the
      // first-loaded survivor and every downstream reference is remapped.
      const patientDedupe = this.dedupeByCompositeKey<CanonicalPatient>(data.patients || [], 'CanonicalPatient');
      const encounterDedupe = this.dedupeByCompositeKey<CanonicalEncounter>(data.encounters || [], 'CanonicalEncounter');
      const conditionDedupe = this.dedupeByCompositeKey<CanonicalCondition>(data.conditions || [], 'CanonicalCondition');
      const observationDedupe = this.dedupeByCompositeKey<CanonicalObservation>(data.observations || [], 'CanonicalObservation');
      const coverageDedupe = this.dedupeByCompositeKey<CanonicalCoverage>(data.coverages || [], 'CanonicalCoverage');
      const claimDedupe = this.dedupeByCompositeKey<CanonicalClaim>(data.claims || [], 'CanonicalClaim');
      const medicationDedupe = this.dedupeByCompositeKey<CanonicalMedicationRequest>(data.medicationRequests || [], 'CanonicalMedicationRequest');
      const immunizationDedupe = this.dedupeByCompositeKey<CanonicalImmunization>(data.immunizations || [], 'CanonicalImmunization');
      const allergyDedupe = this.dedupeByCompositeKey<CanonicalAllergyIntolerance>(data.allergies || [], 'CanonicalAllergyIntolerance');
      const diagnosticReportDedupe = this.dedupeByCompositeKey<CanonicalDiagnosticReport>(data.diagnosticReports || [], 'CanonicalDiagnosticReport');

      const remapPatient = (id: string): string => patientDedupe.remap.get(id) ?? id;
      const remapEncounter = (id: string): string => encounterDedupe.remap.get(id) ?? id;

      for (const p of patientDedupe.items) this.patients.set(p.internalId, p);
      for (const e of encounterDedupe.items) this.encounters.set(e.internalId, e);
      for (const c of conditionDedupe.items) {
        const remapped: any = { ...c, patientId: remapPatient(c.patientId), encounterId: c.encounterId ? remapEncounter(c.encounterId) : undefined };
        this.conditions.set(c.internalId, remapped);
      }
      for (const o of observationDedupe.items) {
        const remapped: any = { ...o, patientId: remapPatient(o.patientId), encounterId: o.encounterId ? remapEncounter(o.encounterId) : undefined };
        this.observations.set(o.internalId, remapped);
      }
      if (data.organizations) for (const org of data.organizations) this.organizations.set(org.internalId, org);
      if (data.practitioners) for (const pr of data.practitioners) this.practitioners.set(pr.internalId, pr);
      for (const cov of coverageDedupe.items) {
        const remapped: any = { ...cov, patientId: remapPatient(cov.patientId) };
        this.coverages.set(cov.internalId, remapped);
      }
      for (const clm of claimDedupe.items) {
        const remapped: any = {
          ...clm,
          patientId: remapPatient(clm.patientId),
          encounterId: (clm as any).encounterId ? remapEncounter((clm as any).encounterId) : undefined,
          coverageId: (clm as any).coverageId ? coverageDedupe.remap.get((clm as any).coverageId) ?? (clm as any).coverageId : undefined
        };
        this.claims.set(clm.internalId, remapped);
      }
      if (data.claimResponses) {
        for (const cr of data.claimResponses) {
          const survivorClaimId = claimDedupe.remap.get(cr.claimId) ?? cr.claimId;
          this.claimResponses.set(survivorClaimId, { ...cr, claimId: survivorClaimId });
        }
      }
      for (const rx of medicationDedupe.items) {
        const remapped: any = { ...rx, patientId: remapPatient(rx.patientId), encounterId: (rx as any).encounterId ? remapEncounter((rx as any).encounterId) : undefined };
        this.medicationRequests.set(rx.internalId, remapped);
      }
      for (const imm of immunizationDedupe.items) {
        const remapped: any = { ...imm, patientId: remapPatient(imm.patientId), encounterId: (imm as any).encounterId ? remapEncounter((imm as any).encounterId) : undefined };
        this.immunizations.set(imm.internalId, remapped);
      }
      for (const alg of allergyDedupe.items) {
        const remapped: any = { ...alg, patientId: remapPatient(alg.patientId) };
        this.allergies.set(alg.internalId, remapped);
      }
      for (const diag of diagnosticReportDedupe.items) {
        const remapped: any = {
          ...diag,
          patientId: remapPatient(diag.patientId),
          encounterId: (diag as any).encounterId ? remapEncounter((diag as any).encounterId) : undefined
        };
        this.diagnosticReports.set(diag.internalId, remapped);
      }

      try {
        const knownEncounters = new Set(this.encounters.keys());
        const healEncounter = (id?: string): string | undefined =>
          id && !knownEncounters.has(id) ? undefined : id;

        for (const c of this.conditions.values()) c.encounterId = healEncounter(c.encounterId as string | undefined);
        for (const o of this.observations.values()) o.encounterId = healEncounter(o.encounterId as string | undefined);
        for (const rx of this.medicationRequests.values()) rx.encounterId = healEncounter(rx.encounterId as string | undefined);
        for (const imm of this.immunizations.values()) imm.encounterId = healEncounter(imm.encounterId as string | undefined);
        for (const diag of this.diagnosticReports.values()) diag.encounterId = healEncounter(diag.encounterId as string | undefined);
        for (const clm of this.claims.values()) clm.encounterId = healEncounter(clm.encounterId as string | undefined);
      } catch {
        // legacy records may lack some optional fields; healing is best-effort
      }

      console.log(`📂 Loaded ${this.patients.size} patient(s), ${this.encounters.size} encounter(s), ${this.medicationRequests.size} medication(s) from disk store.`);
      this.saveToDisk();
    } catch (err: any) {
      console.warn('⚠️ CanonicalStore disk load warning:', err.message);
    }
  }

  // Patient
  async savePatient(patient: CanonicalPatient): Promise<string> {
    // Check if there is an existing record with the same National ID or Iqama
    const nid = patient.identifiers?.find(i => i.type === 'NID' || i.type === 'IQAMA')?.value;
    if (nid) {
      for (const [id, existing] of this.patients) {
        if (id !== patient.internalId) {
          const matchNid = existing.identifiers?.some(i => (i.type === 'NID' || i.type === 'IQAMA') && i.value.trim() === nid.trim());
          if (matchNid) {
            // Reassign any records that pointed to the old ID before deleting duplicate
            for (const [encId, enc] of this.encounters) {
              if (enc.patientId === id) { enc.patientId = patient.internalId; }
            }
            for (const [condId, cond] of this.conditions) {
              if (cond.patientId === id) { cond.patientId = patient.internalId; }
            }
            for (const [obsId, obs] of this.observations) {
              if (obs.patientId === id) { obs.patientId = patient.internalId; }
            }
            for (const [rxId, rx] of this.medicationRequests) {
              if (rx.patientId === id) { rx.patientId = patient.internalId; }
            }
            for (const [immId, imm] of this.immunizations) {
              if (imm.patientId === id) { imm.patientId = patient.internalId; }
            }
            for (const [algId, alg] of this.allergies) {
              if (alg.patientId === id) { alg.patientId = patient.internalId; }
            }
            for (const [diagId, diag] of this.diagnosticReports) {
              if (diag.patientId === id) { diag.patientId = patient.internalId; }
            }
            for (const [covId, cov] of this.coverages) {
              if (cov.patientId === id) { cov.patientId = patient.internalId; }
            }
            for (const [clmId, clm] of this.claims) {
              if (clm.patientId === id) { clm.patientId = patient.internalId; }
            }
            this.patients.delete(id);
          }
        }
      }
    }

    this.patients.set(patient.internalId, { ...patient });
    this.saveToDisk();
    return patient.internalId;
  }

  async getPatient(internalId: string): Promise<CanonicalPatient | null> {
    const p = this.patients.get(internalId);
    if (p) return { ...p };
    return this.findPatientByIdentifier(internalId);
  }

  async findPatientByIdentifier(value: string, sourceSystemId?: string): Promise<CanonicalPatient | null> {
    const normalized = value.trim();

    if (sourceSystemId) {
      for (const p of this.patients.values()) {
        const match = p.identifiers?.some(
          id => id.value.trim() === normalized && id.sourceSystemId === sourceSystemId
        );
        if (match) return { ...p };
      }
    }

    for (const p of this.patients.values()) {
      const match = p.identifiers?.some(
        id => id.value.trim() === normalized && (id.type === 'NID' || id.type === 'IQAMA' || !sourceSystemId)
      );
      if (match) return { ...p };
    }
    return null;
  }

  /**
   * Looks up a patient by its originating source record id (e.g. HL7 motor,
   * dynamic payload, relational row). Used to attach clinical records to the
   * exact patient instance created from the same source record.
   */
  async findPatientBySourceRecordId(sourceSystemId: string, sourceRecordId: string): Promise<CanonicalPatient | null> {
    for (const p of this.patients.values()) {
      if (
        p.provenance?.sourceSystemId === sourceSystemId &&
        p.provenance?.sourceRecordId === sourceRecordId
      ) {
        return { ...p };
      }
    }
    return null;
  }

  async getAllPatients(): Promise<CanonicalPatient[]> {
    return Array.from(this.patients.values()).map(p => ({ ...p }));
  }

  // Encounters
  async saveEncounter(encounter: CanonicalEncounter): Promise<string> {
    const internalId = this.upsertBySource(this.encounters, 'CanonicalEncounter', encounter);
    this.saveToDisk();
    return internalId;
  }

  async getEncounter(internalId: string): Promise<CanonicalEncounter | null> {
    const encounter = this.encounters.get(internalId);
    return encounter ? { ...encounter } : null;
  }

  async findEncounterBySourceVisitId(sourceSystemId: string, sourceVisitId: string): Promise<CanonicalEncounter | null> {
    for (const encounter of this.encounters.values()) {
      if (
        encounter.provenance?.sourceSystemId === sourceSystemId &&
        encounter.sourceVisitId === sourceVisitId
      ) {
        return { ...encounter };
      }
    }
    return null;
  }

  async getEncountersByPatient(patientId: string): Promise<CanonicalEncounter[]> {
    const list: CanonicalEncounter[] = [];
    for (const e of this.encounters.values()) {
      if (e.patientId === patientId) list.push({ ...e });
    }
    return list.sort((a, b) => new Date(b.period.start).getTime() - new Date(a.period.start).getTime());
  }

  async getAllEncounters(): Promise<CanonicalEncounter[]> {
    return Array.from(this.encounters.values()).map(e => ({ ...e }));
  }

  // Conditions
  async saveCondition(condition: CanonicalCondition): Promise<string> {
    const internalId = this.upsertBySource(this.conditions, 'CanonicalCondition', condition);
    this.saveToDisk();
    return internalId;
  }

  async getConditionsByPatient(patientId: string): Promise<CanonicalCondition[]> {
    const list: CanonicalCondition[] = [];
    for (const c of this.conditions.values()) {
      if (c.patientId === patientId) list.push({ ...c });
    }
    return list.sort((a, b) => new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime());
  }

  async getAllConditions(): Promise<CanonicalCondition[]> {
    return Array.from(this.conditions.values()).map(c => ({ ...c }));
  }

  // Observations
  async saveObservation(observation: CanonicalObservation): Promise<string> {
    const internalId = this.upsertBySource(this.observations, 'CanonicalObservation', observation);
    this.saveToDisk();
    return internalId;
  }

  async getObservationsByPatient(patientId: string): Promise<CanonicalObservation[]> {
    const list: CanonicalObservation[] = [];
    for (const o of this.observations.values()) {
      if (o.patientId === patientId) list.push({ ...o });
    }
    return list.sort((a, b) => new Date(b.effectiveDateTime).getTime() - new Date(a.effectiveDateTime).getTime());
  }

  async getAllObservations(): Promise<CanonicalObservation[]> {
    return Array.from(this.observations.values()).map(o => ({ ...o }));
  }

  // Financial: Coverage
  async saveCoverage(coverage: CanonicalCoverage): Promise<string> {
    const internalId = this.upsertBySource(this.coverages, 'CanonicalCoverage', coverage);
    this.saveToDisk();
    return internalId;
  }

  async getCoveragesByPatient(patientId: string): Promise<CanonicalCoverage[]> {
    const list: CanonicalCoverage[] = [];
    for (const c of this.coverages.values()) {
      if (c.patientId === patientId) list.push({ ...c });
    }
    return list;
  }

  async getAllCoverages(): Promise<CanonicalCoverage[]> {
    return Array.from(this.coverages.values()).map(c => ({ ...c }));
  }

  // Financial: Claims & Responses
  async saveClaim(claim: CanonicalClaim): Promise<string> {
    const internalId = this.upsertBySource(this.claims, 'CanonicalClaim', claim);
    this.saveToDisk();
    return internalId;
  }

  async getClaimsByPatient(patientId: string): Promise<CanonicalClaim[]> {
    const list: CanonicalClaim[] = [];
    for (const clm of this.claims.values()) {
      if (clm.patientId === patientId) list.push({ ...clm });
    }
    return list.sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
  }

  async getAllClaims(): Promise<CanonicalClaim[]> {
    return Array.from(this.claims.values()).map(c => ({ ...c }));
  }

  async saveClaimResponse(response: CanonicalClaimResponse): Promise<void> {
    this.claimResponses.set(response.claimId, { ...response });
    this.saveToDisk();
  }

  async getClaimResponse(claimId: string): Promise<CanonicalClaimResponse | null> {
    const r = this.claimResponses.get(claimId);
    return r ? { ...r } : null;
  }

  // Medications
  async saveMedicationRequest(rx: CanonicalMedicationRequest): Promise<string> {
    const internalId = this.upsertBySource(this.medicationRequests, 'CanonicalMedicationRequest', rx);
    this.saveToDisk();
    return internalId;
  }

  async getMedicationRequestsByPatient(patientId: string): Promise<CanonicalMedicationRequest[]> {
    const list: CanonicalMedicationRequest[] = [];
    for (const m of this.medicationRequests.values()) {
      if (m.patientId === patientId) list.push({ ...m });
    }
    return list.sort((a, b) => new Date(b.authoredOn).getTime() - new Date(a.authoredOn).getTime());
  }

  async getAllMedicationRequests(): Promise<CanonicalMedicationRequest[]> {
    return Array.from(this.medicationRequests.values()).map(m => ({ ...m }));
  }

  // Immunizations
  async saveImmunization(imm: CanonicalImmunization): Promise<string> {
    const internalId = this.upsertBySource(this.immunizations, 'CanonicalImmunization', imm);
    this.saveToDisk();
    return internalId;
  }

  async getImmunizationsByPatient(patientId: string): Promise<CanonicalImmunization[]> {
    const list: CanonicalImmunization[] = [];
    for (const i of this.immunizations.values()) {
      if (i.patientId === patientId) list.push({ ...i });
    }
    return list.sort((a, b) => new Date(b.occurrenceDateTime).getTime() - new Date(a.occurrenceDateTime).getTime());
  }

  async getAllImmunizations(): Promise<CanonicalImmunization[]> {
    return Array.from(this.immunizations.values()).map(i => ({ ...i }));
  }

  // Allergies & Intolerances
  async saveAllergyIntolerance(allergy: CanonicalAllergyIntolerance): Promise<string> {
    const internalId = this.upsertBySource(this.allergies, 'CanonicalAllergyIntolerance', allergy);
    this.saveToDisk();
    return internalId;
  }

  async getAllergiesByPatient(patientId: string): Promise<CanonicalAllergyIntolerance[]> {
    const list: CanonicalAllergyIntolerance[] = [];
    for (const a of this.allergies.values()) {
      if (a.patientId === patientId) list.push({ ...a });
    }
    return list.sort((a, b) => new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime());
  }

  async getAllAllergies(): Promise<CanonicalAllergyIntolerance[]> {
    return Array.from(this.allergies.values()).map(a => ({ ...a }));
  }

  // Diagnostic Reports
  async saveDiagnosticReport(report: CanonicalDiagnosticReport): Promise<string> {
    const internalId = this.upsertBySource(this.diagnosticReports, 'CanonicalDiagnosticReport', report);
    this.saveToDisk();
    return internalId;
  }

  async getDiagnosticReportsByPatient(patientId: string): Promise<CanonicalDiagnosticReport[]> {
    const list: CanonicalDiagnosticReport[] = [];
    for (const d of this.diagnosticReports.values()) {
      if (d.patientId === patientId) list.push({ ...d });
    }
    return list.sort((a, b) => new Date(b.issued).getTime() - new Date(a.issued).getTime());
  }

  async getAllDiagnosticReports(): Promise<CanonicalDiagnosticReport[]> {
    return Array.from(this.diagnosticReports.values()).map(d => ({ ...d }));
  }

  // Longitudinal Record ($everything aggregation)
  async getLongitudinalRecord(patientId: string): Promise<LongitudinalRecord | null> {
    let patient = await this.getPatient(patientId);
    if (!patient) {
      patient = await this.findPatientByIdentifier(patientId);
    }
    if (!patient) return null;

    const actualId = patient.internalId;
    const encounters = await this.getEncountersByPatient(actualId);
    const conditions = await this.getConditionsByPatient(actualId);
    const observations = await this.getObservationsByPatient(actualId);
    const coverages = await this.getCoveragesByPatient(actualId);
    const claims = await this.getClaimsByPatient(actualId);
    const medicationRequests = await this.getMedicationRequestsByPatient(actualId);
    const immunizations = await this.getImmunizationsByPatient(actualId);
    const allergies = await this.getAllergiesByPatient(actualId);
    const diagnosticReports = await this.getDiagnosticReportsByPatient(actualId);

    return {
      patient,
      encounters,
      conditions,
      observations,
      coverages,
      claims,
      medicationRequests,
      immunizations,
      allergies,
      diagnosticReports
    };
  }

  // Organizations & Practitioners
  async saveOrganization(org: CanonicalOrganization): Promise<void> {
    this.organizations.set(org.internalId, { ...org });
    this.saveToDisk();
  }

  async savePractitioner(prac: CanonicalPractitioner): Promise<void> {
    this.practitioners.set(prac.internalId, { ...prac });
    this.saveToDisk();
  }

  /**
   * Reassigns all clinical and financial records from an obsolete patient ID to a survivor patient ID during an MPI Merge
   */
  async reassignPatientRecords(sourcePatientId: string, targetPatientId: string): Promise<{
    encountersUpdated: number;
    conditionsUpdated: number;
    observationsUpdated: number;
    medicationsUpdated: number;
    immunizationsUpdated: number;
    allergiesUpdated: number;
    diagnosticReportsUpdated: number;
    claimsUpdated: number;
    coveragesUpdated: number;
  }> {
    let encountersUpdated = 0;
    let conditionsUpdated = 0;
    let observationsUpdated = 0;
    let medicationsUpdated = 0;
    let immunizationsUpdated = 0;
    let allergiesUpdated = 0;
    let diagnosticReportsUpdated = 0;
    let claimsUpdated = 0;
    let coveragesUpdated = 0;

    for (const [id, enc] of this.encounters) {
      if (enc.patientId === sourcePatientId) {
        enc.patientId = targetPatientId;
        this.encounters.set(id, enc);
        encountersUpdated++;
      }
    }

    for (const [id, cond] of this.conditions) {
      if (cond.patientId === sourcePatientId) {
        cond.patientId = targetPatientId;
        this.conditions.set(id, cond);
        conditionsUpdated++;
      }
    }

    for (const [id, obs] of this.observations) {
      if (obs.patientId === sourcePatientId) {
        obs.patientId = targetPatientId;
        this.observations.set(id, obs);
        observationsUpdated++;
      }
    }

    for (const [id, rx] of this.medicationRequests) {
      if (rx.patientId === sourcePatientId) {
        rx.patientId = targetPatientId;
        this.medicationRequests.set(id, rx);
        medicationsUpdated++;
      }
    }

    for (const [id, imm] of this.immunizations) {
      if (imm.patientId === sourcePatientId) {
        imm.patientId = targetPatientId;
        this.immunizations.set(id, imm);
        immunizationsUpdated++;
      }
    }

    for (const [id, alg] of this.allergies) {
      if (alg.patientId === sourcePatientId) {
        alg.patientId = targetPatientId;
        this.allergies.set(id, alg);
        allergiesUpdated++;
      }
    }

    for (const [id, diag] of this.diagnosticReports) {
      if (diag.patientId === sourcePatientId) {
        diag.patientId = targetPatientId;
        this.diagnosticReports.set(id, diag);
        diagnosticReportsUpdated++;
      }
    }

    for (const [id, cov] of this.coverages) {
      if (cov.patientId === sourcePatientId) {
        cov.patientId = targetPatientId;
        this.coverages.set(id, cov);
        coveragesUpdated++;
      }
    }

    for (const [id, clm] of this.claims) {
      if (clm.patientId === sourcePatientId) {
        clm.patientId = targetPatientId;
        this.claims.set(id, clm);
        claimsUpdated++;
      }
    }

    this.saveToDisk();

    return {
      encountersUpdated,
      conditionsUpdated,
      observationsUpdated,
      medicationsUpdated,
      immunizationsUpdated,
      allergiesUpdated,
      diagnosticReportsUpdated,
      claimsUpdated,
      coveragesUpdated
    };
  }

  async clearAll(): Promise<void> {
    this.patients.clear();
    this.encounters.clear();
    this.conditions.clear();
    this.observations.clear();
    this.organizations.clear();
    this.practitioners.clear();
    this.coverages.clear();
    this.claims.clear();
    this.claimResponses.clear();
    this.medicationRequests.clear();
    this.immunizations.clear();
    this.allergies.clear();
    this.diagnosticReports.clear();
    this.saveToDisk();
  }
}
