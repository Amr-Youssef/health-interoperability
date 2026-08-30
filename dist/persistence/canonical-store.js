import fs from 'fs';
import path from 'path';
export class CanonicalStore {
    persistPath;
    patients = new Map();
    encounters = new Map();
    conditions = new Map();
    observations = new Map();
    organizations = new Map();
    practitioners = new Map();
    // Financial stores
    coverages = new Map();
    claims = new Map();
    claimResponses = new Map();
    // Medication, Immunization, Allergy & Diagnostics stores
    medicationRequests = new Map();
    immunizations = new Map();
    allergies = new Map();
    diagnosticReports = new Map();
    constructor(persistPath) {
        if (persistPath === null) {
            this.persistPath = '';
        }
        else {
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
    buildSourceKey(entityType, sourceSystemId, sourceRecordId) {
        if (!sourceSystemId || !sourceRecordId)
            return null;
        return `${entityType}::${sourceSystemId}::${sourceRecordId}`;
    }
    findExistingIdBySource(store, entityType, sourceSystemId, sourceRecordId) {
        const targetKey = this.buildSourceKey(entityType, sourceSystemId, sourceRecordId);
        if (!targetKey)
            return null;
        for (const [id, entity] of store) {
            const entityKey = this.buildSourceKey(entityType, entity.provenance?.sourceSystemId, entity.provenance?.sourceRecordId);
            if (entityKey === targetKey)
                return id;
        }
        return null;
    }
    /**
     * Idempotent upsert keyed on the composite (sourceSystemId + sourceRecordId +
     * entityType). On collision the existing entity is overwritten with the newly
     * received payload while preserving its original internalId and createdAt.
     */
    upsertBySource(store, entityType, entity) {
        const existingId = this.findExistingIdBySource(store, entityType, entity.provenance?.sourceSystemId, entity.provenance?.sourceRecordId);
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
        store.set(existingId, merged);
        return existingId;
    }
    /**
     * Collapses duplicate legacy entities that share the same composite source key.
     * Keeps the first-loaded survivor and records a remap (dropped id -> survivor id)
     * so downstream references can be rewritten during disk load.
     */
    dedupeByCompositeKey(list, entityType) {
        const items = [];
        const seen = new Map();
        const remap = new Map();
        if (!Array.isArray(list))
            return { items: [], remap };
        for (const item of list) {
            const key = this.buildSourceKey(entityType, item.provenance?.sourceSystemId, item.provenance?.sourceRecordId);
            if (!key) {
                items.push(item);
                continue;
            }
            const survivorId = seen.get(key);
            if (survivorId) {
                remap.set(item.internalId, survivorId);
                continue;
            }
            seen.set(key, item.internalId);
            items.push(item);
        }
        return { items, remap };
    }
    /**
     * Persist canonical store data to disk
     */
    saveToDisk() {
        if (!this.persistPath)
            return;
        try {
            const dir = path.dirname(this.persistPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
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
        }
        catch (err) {
            console.warn('⚠️ CanonicalStore disk persistence warning:', err.message);
        }
    }
    /**
     * Load canonical store data from disk
     */
    loadFromDisk() {
        if (!this.persistPath)
            return;
        try {
            if (!fs.existsSync(this.persistPath))
                return;
            const raw = fs.readFileSync(this.persistPath, 'utf-8');
            const data = JSON.parse(raw);
            // Load-time dedupe: legacy snapshots contain rows duplicated across
            // pipeline runs. Entries sharing the same composite source key
            // (entityType::sourceSystemId::sourceRecordId) are collapsed to the
            // first-loaded survivor and every downstream reference is remapped.
            const patientDedupe = this.dedupeByCompositeKey(data.patients || [], 'CanonicalPatient');
            const encounterDedupe = this.dedupeByCompositeKey(data.encounters || [], 'CanonicalEncounter');
            const conditionDedupe = this.dedupeByCompositeKey(data.conditions || [], 'CanonicalCondition');
            const observationDedupe = this.dedupeByCompositeKey(data.observations || [], 'CanonicalObservation');
            const coverageDedupe = this.dedupeByCompositeKey(data.coverages || [], 'CanonicalCoverage');
            const claimDedupe = this.dedupeByCompositeKey(data.claims || [], 'CanonicalClaim');
            const medicationDedupe = this.dedupeByCompositeKey(data.medicationRequests || [], 'CanonicalMedicationRequest');
            const immunizationDedupe = this.dedupeByCompositeKey(data.immunizations || [], 'CanonicalImmunization');
            const allergyDedupe = this.dedupeByCompositeKey(data.allergies || [], 'CanonicalAllergyIntolerance');
            const diagnosticReportDedupe = this.dedupeByCompositeKey(data.diagnosticReports || [], 'CanonicalDiagnosticReport');
            const remapPatient = (id) => patientDedupe.remap.get(id) ?? id;
            const remapEncounter = (id) => encounterDedupe.remap.get(id) ?? id;
            for (const p of patientDedupe.items)
                this.patients.set(p.internalId, p);
            for (const e of encounterDedupe.items)
                this.encounters.set(e.internalId, e);
            for (const c of conditionDedupe.items) {
                const remapped = { ...c, patientId: remapPatient(c.patientId), encounterId: c.encounterId ? remapEncounter(c.encounterId) : undefined };
                this.conditions.set(c.internalId, remapped);
            }
            for (const o of observationDedupe.items) {
                const remapped = { ...o, patientId: remapPatient(o.patientId), encounterId: o.encounterId ? remapEncounter(o.encounterId) : undefined };
                this.observations.set(o.internalId, remapped);
            }
            if (data.organizations)
                for (const org of data.organizations)
                    this.organizations.set(org.internalId, org);
            if (data.practitioners)
                for (const pr of data.practitioners)
                    this.practitioners.set(pr.internalId, pr);
            for (const cov of coverageDedupe.items) {
                const remapped = { ...cov, patientId: remapPatient(cov.patientId) };
                this.coverages.set(cov.internalId, remapped);
            }
            for (const clm of claimDedupe.items) {
                const remapped = {
                    ...clm,
                    patientId: remapPatient(clm.patientId),
                    encounterId: clm.encounterId ? remapEncounter(clm.encounterId) : undefined,
                    coverageId: clm.coverageId ? coverageDedupe.remap.get(clm.coverageId) ?? clm.coverageId : undefined
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
                const remapped = { ...rx, patientId: remapPatient(rx.patientId), encounterId: rx.encounterId ? remapEncounter(rx.encounterId) : undefined };
                this.medicationRequests.set(rx.internalId, remapped);
            }
            for (const imm of immunizationDedupe.items) {
                const remapped = { ...imm, patientId: remapPatient(imm.patientId), encounterId: imm.encounterId ? remapEncounter(imm.encounterId) : undefined };
                this.immunizations.set(imm.internalId, remapped);
            }
            for (const alg of allergyDedupe.items) {
                const remapped = { ...alg, patientId: remapPatient(alg.patientId) };
                this.allergies.set(alg.internalId, remapped);
            }
            for (const diag of diagnosticReportDedupe.items) {
                const remapped = {
                    ...diag,
                    patientId: remapPatient(diag.patientId),
                    encounterId: diag.encounterId ? remapEncounter(diag.encounterId) : undefined
                };
                this.diagnosticReports.set(diag.internalId, remapped);
            }
            try {
                const knownEncounters = new Set(this.encounters.keys());
                const healEncounter = (id) => id && !knownEncounters.has(id) ? undefined : id;
                for (const c of this.conditions.values())
                    c.encounterId = healEncounter(c.encounterId);
                for (const o of this.observations.values())
                    o.encounterId = healEncounter(o.encounterId);
                for (const rx of this.medicationRequests.values())
                    rx.encounterId = healEncounter(rx.encounterId);
                for (const imm of this.immunizations.values())
                    imm.encounterId = healEncounter(imm.encounterId);
                for (const diag of this.diagnosticReports.values())
                    diag.encounterId = healEncounter(diag.encounterId);
                for (const clm of this.claims.values())
                    clm.encounterId = healEncounter(clm.encounterId);
            }
            catch {
                // legacy records may lack some optional fields; healing is best-effort
            }
            console.log(`📂 Loaded ${this.patients.size} patient(s), ${this.encounters.size} encounter(s), ${this.medicationRequests.size} medication(s) from disk store.`);
            this.saveToDisk();
        }
        catch (err) {
            console.warn('⚠️ CanonicalStore disk load warning:', err.message);
        }
    }
    // Patient
    async savePatient(patient) {
        // Check if there is an existing record with the same National ID or Iqama
        const nid = patient.identifiers?.find(i => i.type === 'NID' || i.type === 'IQAMA')?.value;
        if (nid) {
            for (const [id, existing] of this.patients) {
                if (id !== patient.internalId) {
                    const matchNid = existing.identifiers?.some(i => (i.type === 'NID' || i.type === 'IQAMA') && i.value.trim() === nid.trim());
                    if (matchNid) {
                        // Reassign any records that pointed to the old ID before deleting duplicate
                        for (const [encId, enc] of this.encounters) {
                            if (enc.patientId === id) {
                                enc.patientId = patient.internalId;
                            }
                        }
                        for (const [condId, cond] of this.conditions) {
                            if (cond.patientId === id) {
                                cond.patientId = patient.internalId;
                            }
                        }
                        for (const [obsId, obs] of this.observations) {
                            if (obs.patientId === id) {
                                obs.patientId = patient.internalId;
                            }
                        }
                        for (const [rxId, rx] of this.medicationRequests) {
                            if (rx.patientId === id) {
                                rx.patientId = patient.internalId;
                            }
                        }
                        for (const [immId, imm] of this.immunizations) {
                            if (imm.patientId === id) {
                                imm.patientId = patient.internalId;
                            }
                        }
                        for (const [algId, alg] of this.allergies) {
                            if (alg.patientId === id) {
                                alg.patientId = patient.internalId;
                            }
                        }
                        for (const [diagId, diag] of this.diagnosticReports) {
                            if (diag.patientId === id) {
                                diag.patientId = patient.internalId;
                            }
                        }
                        for (const [covId, cov] of this.coverages) {
                            if (cov.patientId === id) {
                                cov.patientId = patient.internalId;
                            }
                        }
                        for (const [clmId, clm] of this.claims) {
                            if (clm.patientId === id) {
                                clm.patientId = patient.internalId;
                            }
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
    async getPatient(internalId) {
        const p = this.patients.get(internalId);
        if (p)
            return { ...p };
        return this.findPatientByIdentifier(internalId);
    }
    async findPatientByIdentifier(value, sourceSystemId) {
        const normalized = value.trim();
        if (sourceSystemId) {
            for (const p of this.patients.values()) {
                const match = p.identifiers?.some(id => id.value.trim() === normalized && id.sourceSystemId === sourceSystemId);
                if (match)
                    return { ...p };
            }
        }
        for (const p of this.patients.values()) {
            const match = p.identifiers?.some(id => id.value.trim() === normalized && (id.type === 'NID' || id.type === 'IQAMA' || !sourceSystemId));
            if (match)
                return { ...p };
        }
        return null;
    }
    /**
     * Looks up a patient by its originating source record id (e.g. HL7 motor,
     * dynamic payload, relational row). Used to attach clinical records to the
     * exact patient instance created from the same source record.
     */
    async findPatientBySourceRecordId(sourceSystemId, sourceRecordId) {
        for (const p of this.patients.values()) {
            if (p.provenance?.sourceSystemId === sourceSystemId &&
                p.provenance?.sourceRecordId === sourceRecordId) {
                return { ...p };
            }
        }
        return null;
    }
    async getAllPatients() {
        return Array.from(this.patients.values()).map(p => ({ ...p }));
    }
    // Encounters
    async saveEncounter(encounter) {
        const internalId = this.upsertBySource(this.encounters, 'CanonicalEncounter', encounter);
        this.saveToDisk();
        return internalId;
    }
    async getEncounter(internalId) {
        const encounter = this.encounters.get(internalId);
        return encounter ? { ...encounter } : null;
    }
    async findEncounterBySourceVisitId(sourceSystemId, sourceVisitId) {
        for (const encounter of this.encounters.values()) {
            if (encounter.provenance?.sourceSystemId === sourceSystemId &&
                encounter.sourceVisitId === sourceVisitId) {
                return { ...encounter };
            }
        }
        return null;
    }
    async getEncountersByPatient(patientId) {
        const list = [];
        for (const e of this.encounters.values()) {
            if (e.patientId === patientId)
                list.push({ ...e });
        }
        return list.sort((a, b) => new Date(b.period.start).getTime() - new Date(a.period.start).getTime());
    }
    async getAllEncounters() {
        return Array.from(this.encounters.values()).map(e => ({ ...e }));
    }
    // Conditions
    async saveCondition(condition) {
        const internalId = this.upsertBySource(this.conditions, 'CanonicalCondition', condition);
        this.saveToDisk();
        return internalId;
    }
    async getConditionsByPatient(patientId) {
        const list = [];
        for (const c of this.conditions.values()) {
            if (c.patientId === patientId)
                list.push({ ...c });
        }
        return list.sort((a, b) => new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime());
    }
    async getAllConditions() {
        return Array.from(this.conditions.values()).map(c => ({ ...c }));
    }
    // Observations
    async saveObservation(observation) {
        const internalId = this.upsertBySource(this.observations, 'CanonicalObservation', observation);
        this.saveToDisk();
        return internalId;
    }
    async getObservationsByPatient(patientId) {
        const list = [];
        for (const o of this.observations.values()) {
            if (o.patientId === patientId)
                list.push({ ...o });
        }
        return list.sort((a, b) => new Date(b.effectiveDateTime).getTime() - new Date(a.effectiveDateTime).getTime());
    }
    async getAllObservations() {
        return Array.from(this.observations.values()).map(o => ({ ...o }));
    }
    // Financial: Coverage
    async saveCoverage(coverage) {
        const internalId = this.upsertBySource(this.coverages, 'CanonicalCoverage', coverage);
        this.saveToDisk();
        return internalId;
    }
    async getCoveragesByPatient(patientId) {
        const list = [];
        for (const c of this.coverages.values()) {
            if (c.patientId === patientId)
                list.push({ ...c });
        }
        return list;
    }
    async getAllCoverages() {
        return Array.from(this.coverages.values()).map(c => ({ ...c }));
    }
    // Financial: Claims & Responses
    async saveClaim(claim) {
        const internalId = this.upsertBySource(this.claims, 'CanonicalClaim', claim);
        this.saveToDisk();
        return internalId;
    }
    async getClaimsByPatient(patientId) {
        const list = [];
        for (const clm of this.claims.values()) {
            if (clm.patientId === patientId)
                list.push({ ...clm });
        }
        return list.sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
    }
    async getAllClaims() {
        return Array.from(this.claims.values()).map(c => ({ ...c }));
    }
    async saveClaimResponse(response) {
        this.claimResponses.set(response.claimId, { ...response });
        this.saveToDisk();
    }
    async getClaimResponse(claimId) {
        const r = this.claimResponses.get(claimId);
        return r ? { ...r } : null;
    }
    // Medications
    async saveMedicationRequest(rx) {
        const internalId = this.upsertBySource(this.medicationRequests, 'CanonicalMedicationRequest', rx);
        this.saveToDisk();
        return internalId;
    }
    async getMedicationRequestsByPatient(patientId) {
        const list = [];
        for (const m of this.medicationRequests.values()) {
            if (m.patientId === patientId)
                list.push({ ...m });
        }
        return list.sort((a, b) => new Date(b.authoredOn).getTime() - new Date(a.authoredOn).getTime());
    }
    async getAllMedicationRequests() {
        return Array.from(this.medicationRequests.values()).map(m => ({ ...m }));
    }
    // Immunizations
    async saveImmunization(imm) {
        const internalId = this.upsertBySource(this.immunizations, 'CanonicalImmunization', imm);
        this.saveToDisk();
        return internalId;
    }
    async getImmunizationsByPatient(patientId) {
        const list = [];
        for (const i of this.immunizations.values()) {
            if (i.patientId === patientId)
                list.push({ ...i });
        }
        return list.sort((a, b) => new Date(b.occurrenceDateTime).getTime() - new Date(a.occurrenceDateTime).getTime());
    }
    async getAllImmunizations() {
        return Array.from(this.immunizations.values()).map(i => ({ ...i }));
    }
    // Allergies & Intolerances
    async saveAllergyIntolerance(allergy) {
        const internalId = this.upsertBySource(this.allergies, 'CanonicalAllergyIntolerance', allergy);
        this.saveToDisk();
        return internalId;
    }
    async getAllergiesByPatient(patientId) {
        const list = [];
        for (const a of this.allergies.values()) {
            if (a.patientId === patientId)
                list.push({ ...a });
        }
        return list.sort((a, b) => new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime());
    }
    async getAllAllergies() {
        return Array.from(this.allergies.values()).map(a => ({ ...a }));
    }
    // Diagnostic Reports
    async saveDiagnosticReport(report) {
        const internalId = this.upsertBySource(this.diagnosticReports, 'CanonicalDiagnosticReport', report);
        this.saveToDisk();
        return internalId;
    }
    async getDiagnosticReportsByPatient(patientId) {
        const list = [];
        for (const d of this.diagnosticReports.values()) {
            if (d.patientId === patientId)
                list.push({ ...d });
        }
        return list.sort((a, b) => new Date(b.issued).getTime() - new Date(a.issued).getTime());
    }
    async getAllDiagnosticReports() {
        return Array.from(this.diagnosticReports.values()).map(d => ({ ...d }));
    }
    // Longitudinal Record ($everything aggregation)
    async getLongitudinalRecord(patientId) {
        let patient = await this.getPatient(patientId);
        if (!patient) {
            patient = await this.findPatientByIdentifier(patientId);
        }
        if (!patient)
            return null;
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
    async saveOrganization(org) {
        this.organizations.set(org.internalId, { ...org });
        this.saveToDisk();
    }
    async savePractitioner(prac) {
        this.practitioners.set(prac.internalId, { ...prac });
        this.saveToDisk();
    }
    /**
     * Reassigns all clinical and financial records from an obsolete patient ID to a survivor patient ID during an MPI Merge
     */
    async reassignPatientRecords(sourcePatientId, targetPatientId) {
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
    async clearAll() {
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
//# sourceMappingURL=canonical-store.js.map