import { v4 as uuidv4 } from 'uuid';
import { DynamicHospitalRegistry } from '../ingestion/dynamic/dynamic-adapter.js';
import { MappingEngine } from '../mapping/engine/mapping-engine.js';
import { DataQualityEngine } from '../validation/validation-engine.js';
import { FhirR4Serializer } from '../fhir/fhir-serializer.js';
import { NphiesSandboxSimulator } from '../integration/nphies/nphies-sandbox.js';
import { CdsHooksEngine } from '../cds/cds-engine.js';
import { ConsentManager } from '../security/consent-manager.js';
import { PopulationHealthService } from '../analytics/population-health.js';
import { WeqaaSurveillanceEngine } from '../analytics/weqaa-surveillance.js';
import { CryptographicAuditChain } from '../security/audit-chain.js';
import { FhirBulkExportService } from '../export/bulk-export.js';
import { Hl7v2FeedAdapter } from '../ingestion/hl7v2/hl7-adapter.js';
import { SmartOnFhirAuthService } from '../security/smart-auth.js';
/**
 * Thrown when a clinical/financial record cannot be linked to an existing
 * patient or encounter. Previously the engine silently attached such records
 * to the first patient in the store; now the reference must resolve or the
 * record is rejected for referential integrity.
 */
export class UnresolvedReferenceError extends Error {
    sourceSystemId;
    sourceRecordId;
    referenceKind;
    referenceValue;
    constructor(sourceSystemId, sourceRecordId, referenceKind, referenceValue) {
        super(`Unresolved ${referenceKind} reference ['${referenceValue}'] for source record ['${sourceRecordId}'] from ['${sourceSystemId}'] — REJECTED for referential integrity.`);
        this.name = 'UnresolvedReferenceError';
        this.sourceSystemId = sourceSystemId;
        this.sourceRecordId = sourceRecordId;
        this.referenceKind = referenceKind;
        this.referenceValue = referenceValue;
    }
}
export class NormalizationEngine {
    rawStore;
    mappingEngine;
    terminologyService;
    qualityEngine;
    mpi;
    canonicalStore;
    provenanceService;
    fhirSerializer;
    nphiesSimulator;
    dynamicRegistry;
    cdsEngine;
    consentManager;
    populationHealth;
    weqaaSurveillance;
    auditChain;
    bulkExportService;
    hl7Adapter;
    smartAuth;
    adapters = new Map();
    // Correlation maps
    mrnToInternalPatientId = new Map();
    visitToInternalEncounterId = new Map();
    constructor(rawStore, canonicalStore, mpi, terminologyService, provenanceService, consentManager, auditChain, dynamicRegistry) {
        this.rawStore = rawStore;
        this.canonicalStore = canonicalStore;
        this.mpi = mpi;
        this.terminologyService = terminologyService;
        this.provenanceService = provenanceService;
        this.mappingEngine = new MappingEngine(this.terminologyService);
        this.qualityEngine = new DataQualityEngine();
        this.fhirSerializer = new FhirR4Serializer();
        this.nphiesSimulator = new NphiesSandboxSimulator();
        this.dynamicRegistry = dynamicRegistry || new DynamicHospitalRegistry();
        this.cdsEngine = new CdsHooksEngine(this.canonicalStore);
        this.consentManager = consentManager || new ConsentManager();
        this.populationHealth = new PopulationHealthService(this.canonicalStore);
        this.weqaaSurveillance = new WeqaaSurveillanceEngine(this.canonicalStore, this.fhirSerializer);
        this.auditChain = auditChain || new CryptographicAuditChain();
        this.bulkExportService = new FhirBulkExportService(this.canonicalStore);
        this.hl7Adapter = new Hl7v2FeedAdapter();
        this.smartAuth = new SmartOnFhirAuthService();
        // Register Standard Source Adapters & Protocol Feeds
        this.adapters.set(this.hl7Adapter.sourceSystemId, this.hl7Adapter);
        // Register HL7 v2 Mapping Configurations
        this.mappingEngine.registerConfiguration({
            id: 'map-hl7-patient-admission',
            sourceSystemId: 'hl7v2-mllp-feed',
            sourceEntityType: 'hl7_patient_admission',
            targetCanonicalEntity: 'CanonicalPatient',
            mappingVersion: '1.0.0',
            effectiveDate: '2026-01-01',
            status: 'ACTIVE',
            author: 'HL7v2 Integration Engine',
            description: 'Maps HL7 v2 ADT A01 PID segment to CanonicalPatient',
            validationState: 'VALIDATED',
            fieldMappings: [
                { sourceField: 'patient.mrn', targetField: 'mrn', required: true },
                { sourceField: 'patient.nationalId', targetField: 'nationalId', required: false },
                { sourceField: 'patient.givenName', targetField: 'givenName', required: true },
                { sourceField: 'patient.familyName', targetField: 'familyName', required: true },
                { sourceField: 'patient.givenNameAr', targetField: 'givenNameAr', required: false },
                { sourceField: 'patient.familyNameAr', targetField: 'familyNameAr', required: false },
                { sourceField: 'patient.gender', targetField: 'gender', required: true, transformation: 'gender_normalize' },
                { sourceField: 'patient.birthDate', targetField: 'birthDate', required: true, transformation: 'date_normalize' },
                { sourceField: 'patient.phone', targetField: 'phone', required: false }
            ]
        });
        // Register Dynamic Adapters from Registry
        for (const dynAdapter of this.dynamicRegistry.getAllAdapters()) {
            this.adapters.set(dynAdapter.sourceSystemId, dynAdapter);
            for (const config of dynAdapter.definition.defaultMappingConfigs) {
                this.mappingEngine.registerConfiguration(config);
            }
        }
    }
    /**
     * Ingest and normalize a raw HL7 v2 pipe-delimited message
     */
    async ingestHl7v2Message(rawHl7) {
        const { rawRecord, parsed } = this.hl7Adapter.processHl7Message(rawHl7);
        await this.rawStore.save(rawRecord);
        const mapped = await this.mappingEngine.mapRecord(rawRecord);
        const validation = await this.qualityEngine.validate(mapped);
        if (validation.decision !== 'REJECTED') {
            let persistOutcome = null;
            try {
                persistOutcome = await this.persistToCanonical(mapped, rawRecord, validation);
                await this.rawStore.updateStatus(rawRecord.id, 'PERSISTED');
            }
            catch (err) {
                await this.rawStore.updateStatus(rawRecord.id, 'FAILED', err.message);
                return {
                    rawRecordId: rawRecord.id,
                    parsed,
                    mapped,
                    validation: {
                        ...validation,
                        decision: 'REJECTED',
                        issues: [
                            ...(validation.issues || []),
                            { field: 'referential-link', severity: 'ERROR', rule: 'REFERENTIAL_INTEGRITY', message: err.message, sourceValue: '' }
                        ]
                    }
                };
            }
            // For ADT A01, also create CanonicalEncounter from PV1 segment.
            // The encounter is strictly linked to the patient that was resolved by the
            // MPI for THIS message — never silently attached to the last patient.
            if (parsed.messageType === 'ADT' && parsed.triggerEvent === 'A01' && rawRecord.payload?.encounter) {
                const enc = rawRecord.payload.encounter;
                const timestamp = new Date().toISOString();
                const patientId = persistOutcome?.patientId;
                if (!patientId) {
                    await this.rawStore.updateStatus(rawRecord.id, 'FAILED', 'Unresolved patient reference for HL7 admission encounter');
                    return {
                        rawRecordId: rawRecord.id,
                        parsed,
                        mapped,
                        validation: {
                            ...validation,
                            decision: 'REJECTED',
                            issues: [
                                ...(validation.issues || []),
                                { field: 'referential-link', severity: 'ERROR', rule: 'REFERENTIAL_INTEGRITY', message: 'Unresolved patient reference for HL7 admission encounter', sourceValue: '' }
                            ]
                        }
                    };
                }
                const encounterId = `enc-hl7-${parsed.messageControlId || uuidv4()}`;
                const canonicalEncounter = {
                    internalId: encounterId,
                    patientId,
                    sourceVisitId: enc.visitNo,
                    status: 'in-progress',
                    class: enc.patientClass || 'outpatient',
                    period: { start: enc.admitDate || timestamp },
                    departmentAr: enc.department,
                    provenance: {
                        sourceSystemId: rawRecord.sourceSystemId,
                        sourceRecordId: rawRecord.sourceRecordId,
                        rawRecordId: rawRecord.id,
                        adapterVersion: rawRecord.adapterVersion,
                        mappingVersion: '1.0.0',
                        terminologyMapVersion: '1.0.0',
                        ingestedAt: rawRecord.ingestedAt,
                        transformedAt: timestamp,
                        persistedAt: timestamp,
                        validationScore: validation.score,
                        validationDecision: validation.decision
                    },
                    createdAt: timestamp
                };
                const savedEncounterId = await this.canonicalStore.saveEncounter(canonicalEncounter);
                this.visitToInternalEncounterId.set(`${rawRecord.sourceSystemId}:${enc.visitNo}`, savedEncounterId);
            }
            this.auditChain.recordEvent('INGEST', 'HL7_MLLP_FEED', 'HL7v2Message', rawRecord.sourceRecordId, `Normalized HL7 v2 [${parsed.messageType}^${parsed.triggerEvent}] from ${parsed.sendingFacility}`);
        }
        else {
            await this.rawStore.updateStatus(rawRecord.id, 'FAILED', validation.issues.map(i => i.message).join('; '));
        }
        return {
            rawRecordId: rawRecord.id,
            parsed,
            mapped,
            validation
        };
    }
    /**
     * Onboard a new Healthcare Facility / Hospital dynamically
     */
    onboardHospital(definition) {
        const adapter = this.dynamicRegistry.registerHospital(definition);
        this.adapters.set(adapter.sourceSystemId, adapter);
        for (const config of definition.defaultMappingConfigs) {
            this.mappingEngine.registerConfiguration(config);
        }
        this.auditChain.recordEvent('INGEST', 'ONBOARDING_WIZARD', 'DynamicHospitalDefinition', definition.hospitalId, `Onboarded new facility [${definition.hospitalNameAr}]`);
    }
    /**
     * Ingest and normalize a custom payload for a dynamic hospital
     */
    async ingestDynamicPayload(hospitalId, entityType, sourceRecordId, payload) {
        const adapter = this.dynamicRegistry.getAdapter(hospitalId);
        if (!adapter)
            throw new Error(`Hospital [${hospitalId}] is not registered in the dynamic registry.`);
        const rawRecord = adapter.queueRawRecord(entityType, sourceRecordId, payload);
        await this.rawStore.save(rawRecord);
        const mapped = await this.mappingEngine.mapRecord(rawRecord);
        const validation = await this.qualityEngine.validate(mapped);
        if (validation.decision !== 'REJECTED') {
            try {
                await this.persistToCanonical(mapped, rawRecord, validation);
                await this.rawStore.updateStatus(rawRecord.id, 'PERSISTED');
                this.auditChain.recordEvent('TRANSFORM', 'NORMALIZATION_PIPELINE', mapped.targetCanonicalEntity, rawRecord.id, `Normalized dynamic payload with score ${validation.score}/100`);
            }
            catch (err) {
                // Referential integrity gate: unable to link to a real patient/encounter
                // is treated as a hard rejection, never a silent first-patient fallback.
                console.warn(`[ingestDynamicPayload] ${err.message}`);
                await this.rawStore.updateStatus(rawRecord.id, 'FAILED', err.message);
                return {
                    rawRecordId: rawRecord.id,
                    mapped,
                    validation: {
                        ...validation,
                        decision: 'REJECTED',
                        issues: [
                            ...(validation.issues || []),
                            { field: 'referential-link', severity: 'ERROR', rule: 'REFERENTIAL_INTEGRITY', message: err.message, sourceValue: '' }
                        ]
                    }
                };
            }
        }
        else {
            await this.rawStore.updateStatus(rawRecord.id, 'FAILED', validation.issues.map(i => i.message).join('; '));
        }
        return {
            rawRecordId: rawRecord.id,
            mapped,
            validation
        };
    }
    /**
     * Ingest and normalize an uploaded raw clinical/financial file (.hl7, .json, .csv)
     */
    async ingestUploadedFile(fileName, fileContent, sourceSystemId = 'file-dropzone-uploader') {
        const trimmed = fileContent.trim();
        const timestamp = new Date().toISOString();
        // 1. Format Detection: HL7 v2.x Message
        if (fileName.toLowerCase().endsWith('.hl7') || trimmed.startsWith('MSH|')) {
            const hl7Result = await this.ingestHl7v2Message(trimmed);
            return {
                format: 'hl7v2',
                fileName,
                totalIngested: 1,
                success: hl7Result.validation?.decision !== 'REJECTED',
                details: hl7Result
            };
        }
        // 2. Format Detection: JSON (FHIR Bundle, array of objects, or single object)
        if (fileName.toLowerCase().endsWith('.json') || (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                const parsedJson = JSON.parse(trimmed);
                // Subcase A: FHIR R4 Bundle
                if (parsedJson.resourceType === 'Bundle' && Array.isArray(parsedJson.entry)) {
                    let processedEntries = 0;
                    const entryResults = [];
                    for (const entry of parsedJson.entry) {
                        const resource = entry.resource;
                        if (!resource)
                            continue;
                        if (resource.resourceType === 'Patient') {
                            const nid = resource.identifier?.find((i) => i.system?.includes('nid') || i.type?.coding?.[0]?.code === 'NNKSA')?.value || '1088445566';
                            const nameObj = resource.name?.[0] || {};
                            const given = nameObj.given?.join(' ') || 'Mohammed';
                            const family = nameObj.family || 'Al-Harbi';
                            const rawRecord = {
                                id: uuidv4(),
                                sourceSystemId,
                                sourceEntityType: 'fhir_patient',
                                sourceRecordId: resource.id || uuidv4(),
                                payload: resource,
                                payloadFormat: 'fhir-resource',
                                adapterVersion: '2.0.0',
                                ingestedAt: timestamp,
                                checksum: uuidv4().replace(/-/g, ''),
                                processingStatus: 'PENDING'
                            };
                            await this.rawStore.save(rawRecord);
                            const canonicalPatient = {
                                internalId: resource.id || uuidv4(),
                                identifiers: [
                                    { type: 'NID', value: nid, system: 'urn:sa:nid', sourceSystemId, isActive: true, firstSeenAt: timestamp },
                                    { type: 'MRN', value: resource.id || 'MRN-FHIR-01', system: `urn:sa:facility:${sourceSystemId}`, sourceSystemId, isActive: true, firstSeenAt: timestamp }
                                ],
                                givenName: given,
                                familyName: family,
                                givenNameAr: nameObj.text || given,
                                familyNameAr: family,
                                gender: resource.gender === 'female' ? 'female' : 'male',
                                birthDate: resource.birthDate || '1985-05-15',
                                nationality: 'SAU',
                                phone: resource.telecom?.[0]?.value || '+966500000000',
                                address: {
                                    city: 'Riyadh',
                                    country: 'SAU'
                                },
                                maritalStatus: 'M',
                                provenance: {
                                    sourceSystemId,
                                    sourceRecordId: resource.id || 'REC-FHIR',
                                    rawRecordId: rawRecord.id,
                                    adapterVersion: '2.0.0',
                                    mappingVersion: '1.0.0',
                                    terminologyMapVersion: '1.0.0',
                                    ingestedAt: timestamp,
                                    transformedAt: timestamp,
                                    persistedAt: timestamp,
                                    validationScore: 98,
                                    validationDecision: 'ACCEPTED'
                                },
                                createdAt: timestamp,
                                updatedAt: timestamp
                            };
                            const identity = await this.mpi.resolvePatientIdentity({
                                sourceSystemId,
                                nationalId: nid,
                                mrn: resource.id || 'MRN-FHIR-01',
                                givenName: given,
                                familyName: family,
                                givenNameAr: nameObj.text || given,
                                familyNameAr: family,
                                birthDate: resource.birthDate || '1985-05-15',
                                gender: resource.gender === 'female' ? 'female' : 'male',
                                phone: resource.telecom?.[0]?.value || '+966500000000'
                            });
                            canonicalPatient.internalId = identity.internalPatientId;
                            await this.canonicalStore.savePatient(canonicalPatient);
                            this.mrnToInternalPatientId.set(`${sourceSystemId}:${resource.id || 'MRN-FHIR-01'}`, identity.internalPatientId);
                            processedEntries++;
                            entryResults.push({ type: 'Patient', id: canonicalPatient.internalId, mpiId: identity.internalPatientId });
                        }
                    }
                    this.auditChain.recordEvent('INGEST', 'FILE_UPLOAD_DROPZONE', 'FHIRBundle', fileName, `Ingested FHIR R4 Bundle with ${processedEntries} resource(s)`);
                    return {
                        format: 'fhir-bundle',
                        fileName,
                        totalIngested: processedEntries,
                        success: true,
                        details: { entries: entryResults }
                    };
                }
                // Subcase B: Array of records or single record
                const records = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
                let ingestedCount = 0;
                for (const item of records) {
                    const res = await this.ingestDynamicPayload('hospital-d', item.entityType || 'client_registry', item.id || `REC-${Date.now()}`, item);
                    if (res.validation?.decision !== 'REJECTED')
                        ingestedCount++;
                }
                return {
                    format: 'json',
                    fileName,
                    totalIngested: ingestedCount,
                    success: ingestedCount > 0,
                    details: { recordsIngested: ingestedCount }
                };
            }
            catch (e) {
                throw new Error(`Invalid JSON file content: ${e.message}`);
            }
        }
        // 3. Format Detection: CSV (Comma-Separated Values)
        const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length >= 2) {
            const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
            let csvIngestedCount = 0;
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
                const rowObj = {};
                headers.forEach((h, idx) => {
                    rowObj[h] = values[idx] || '';
                });
                // Translate CSV row to dynamic hospital patient
                const payload = {
                    client_id: rowObj.client_id || rowObj.mrn || rowObj.id || `CSV-${i}`,
                    national_id_num: rowObj.national_id || rowObj.national_id_num || rowObj.nid || '1088445566',
                    full_arabic_name: rowObj.full_arabic_name || rowObj.name_ar || rowObj.name || 'مريض ملف CSV',
                    dob_gregorian: rowObj.dob_gregorian || rowObj.birthdate || rowObj.dob || '1988-03-20',
                    sex_code: rowObj.sex_code || rowObj.gender || rowObj.sex || 'M'
                };
                const res = await this.ingestDynamicPayload('hospital-d', 'client_registry', payload.client_id, payload);
                if (res.validation?.decision !== 'REJECTED')
                    csvIngestedCount++;
            }
            this.auditChain.recordEvent('INGEST', 'FILE_UPLOAD_DROPZONE', 'CSV_Registry', fileName, `Ingested and normalized ${csvIngestedCount} records from CSV file`);
            return {
                format: 'csv',
                fileName,
                totalIngested: csvIngestedCount,
                success: csvIngestedCount > 0,
                details: { rowsProcessed: csvIngestedCount }
            };
        }
        throw new Error('Unsupported or unrecognized file format. Please upload .hl7, .json, or .csv files.');
    }
    /**
     * Complete End-to-End Orchestration: Ingest all sources and normalize into Canonical Store
     */
    async runFullIngestionPipeline() {
        const batchId = uuidv4();
        const sourceCounts = {};
        let totalIngested = 0;
        // 1. Ingestion Phase: Run each adapter and save immutable raw payloads
        for (const adapter of this.adapters.values()) {
            const records = await adapter.extractAll(batchId);
            if (records.length > 0) {
                await this.rawStore.saveBatch(records);
            }
            sourceCounts[adapter.sourceSystemId] = records.length;
            totalIngested += records.length;
        }
        this.auditChain.recordEvent('INGEST', 'ADAPTER_EXTRACTOR', 'RawBatch', batchId, `Ingested ${totalIngested} raw records across all source systems`);
        // 2. Normalization Phase: Process in logical dependency order
        const pendingRecords = await this.rawStore.findPending();
        const sorted = pendingRecords.sort((a, b) => {
            const rank = (type) => {
                const t = type.toLowerCase();
                if (t.includes('patient') || t.includes('pt_master') || t.includes('client_registry'))
                    return 1;
                if (t.includes('insur') || t.includes('polic') || t.includes('coverage'))
                    return 2;
                if (t.includes('visit') || t.includes('encounter') || t.includes('surgery_encounters'))
                    return 3;
                if (t.includes('diag') || t.includes('dx') || t.includes('condition'))
                    return 4;
                if (t.includes('lab') || t.includes('observation'))
                    return 5;
                if (t.includes('presc') || t.includes('rx') || t.includes('medication'))
                    return 6;
                if (t.includes('vax') || t.includes('vaccin') || t.includes('immuniz'))
                    return 7;
                return 8; // claims and bills
            };
            return rank(a.sourceEntityType) - rank(b.sourceEntityType);
        });
        let processedCount = 0;
        let acceptedCount = 0;
        let warningCount = 0;
        let rejectedCount = 0;
        for (const raw of sorted) {
            try {
                // Stage 1 - 3: Mapping Engine
                const mapped = await this.mappingEngine.mapRecord(raw);
                // Stage 4: Data Quality & Validation Gate
                const validation = await this.qualityEngine.validate(mapped);
                if (validation.decision === 'REJECTED') {
                    await this.rawStore.updateStatus(raw.id, 'FAILED', validation.issues.map(i => i.message).join('; '));
                    rejectedCount++;
                    continue;
                }
                if (validation.decision === 'ACCEPTED_WITH_WARNINGS') {
                    warningCount++;
                }
                else {
                    acceptedCount++;
                }
                // Stage 5: Canonical Transformation & Persistence
                await this.persistToCanonical(mapped, raw, validation);
                await this.rawStore.updateStatus(raw.id, 'PERSISTED');
                processedCount++;
            }
            catch (err) {
                console.error(`Error processing raw record [${raw.id}]:`, err.message);
                await this.rawStore.updateStatus(raw.id, 'FAILED', err.message);
                rejectedCount++;
            }
        }
        const patients = await this.canonicalStore.getAllPatients();
        const coverages = await this.canonicalStore.getAllCoverages();
        const claims = await this.canonicalStore.getAllClaims();
        const medications = await this.canonicalStore.getAllMedicationRequests();
        const immunizations = await this.canonicalStore.getAllImmunizations();
        const allergies = await this.canonicalStore.getAllAllergies();
        const diagnosticReports = await this.canonicalStore.getAllDiagnosticReports();
        return {
            batchId,
            sourceCounts,
            totalIngested,
            processedCount,
            acceptedCount,
            warningCount,
            rejectedCount,
            patientsResolvedCount: patients.length,
            coveragesCount: coverages.length,
            claimsCount: claims.length,
            medicationsCount: medications.length,
            immunizationsCount: immunizations.length,
            allergiesCount: allergies.length,
            diagnosticReportsCount: diagnosticReports.length
        };
    }
    /**
     * Resolves a patient from source-level identifiers (MRN, FHIR source id,
     * source record id). Returns null when the patient is genuinely unknown —
     * the caller must REJECT the record, never fall back to an arbitrary patient.
     */
    async resolvePatientId(sourceSystemId, candidates) {
        for (const cand of candidates) {
            const value = cand?.trim();
            if (!value || value === 'undefined' || value === 'null')
                continue;
            const mapped = this.mrnToInternalPatientId.get(`${sourceSystemId}:${value}`);
            if (mapped)
                return mapped;
            const byIdentifier = await this.canonicalStore.findPatientByIdentifier(value, sourceSystemId);
            if (byIdentifier)
                return byIdentifier.internalId;
            const bySource = await this.canonicalStore.findPatientBySourceRecordId(sourceSystemId, value);
            if (bySource)
                return bySource.internalId;
        }
        return null;
    }
    /**
     * Resolves a canonical encounter by its source visit identifier. Returns null
     * when the visit is genuinely unknown for this source system.
     */
    async resolveEncounter(sourceSystemId, sourceVisitId) {
        const visit = sourceVisitId?.trim();
        if (!visit || visit === 'undefined' || visit === 'null')
            return null;
        const mapped = this.visitToInternalEncounterId.get(`${sourceSystemId}:${visit}`);
        if (mapped) {
            const enc = await this.canonicalStore.getEncounter(mapped);
            if (enc)
                return enc;
        }
        return this.canonicalStore.findEncounterBySourceVisitId(sourceSystemId, visit);
    }
    /**
     * Resolves the patient and encounter a clinical record must be attached to.
     * Integrity policy (no fallback-to-first-patient):
     *  - If the payload references a visit, that visit MUST exist; the patient is
     *    then derived from the resolved encounter.
     *  - Otherwise the payload MUST reference a resolvable patient (MRN/source id).
     * Any missing link throws UnresolvedReferenceError -> the record is rejected.
     */
    async resolveClinicalSubject(sourceSystemId, sourceRecordId, data) {
        const sourceVisitId = data.sourceVisitId;
        const patientRef = data.sourcePatientMrn || data.sourcePatientRef || data.sourcePatientId || data.patientMrn;
        if (sourceVisitId) {
            const encounter = await this.resolveEncounter(sourceSystemId, sourceVisitId);
            if (!encounter) {
                throw new UnresolvedReferenceError(sourceSystemId, sourceRecordId, 'encounter', String(sourceVisitId));
            }
            return { patientId: encounter.patientId, encounterId: encounter.internalId };
        }
        const patientId = await this.resolvePatientId(sourceSystemId, [patientRef]);
        if (!patientId) {
            throw new UnresolvedReferenceError(sourceSystemId, sourceRecordId, 'patient', String(patientRef ?? '(none provided)'));
        }
        return { patientId };
    }
    async persistToCanonical(mapped, raw, validation) {
        const timestamp = new Date().toISOString();
        const data = mapped.data;
        const provenance = {
            sourceSystemId: raw.sourceSystemId,
            sourceRecordId: raw.sourceRecordId,
            rawRecordId: raw.id,
            adapterVersion: raw.adapterVersion,
            mappingVersion: mapped.mappingVersion,
            terminologyMapVersion: mapped.terminologyMapVersion || '1.0.0',
            ingestedAt: raw.ingestedAt,
            transformedAt: timestamp,
            persistedAt: timestamp,
            validationScore: validation.score,
            validationDecision: validation.decision
        };
        if (mapped.targetCanonicalEntity === 'CanonicalPatient') {
            // 1. Master Patient Index Resolution
            const identity = await this.mpi.resolvePatientIdentity({
                sourceSystemId: raw.sourceSystemId,
                nationalId: data.nationalId,
                iqamaNo: data.iqamaNo,
                mrn: data.mrn,
                givenName: data.givenName,
                familyName: data.familyName,
                givenNameAr: data.givenNameAr,
                familyNameAr: data.familyNameAr,
                birthDate: data.birthDate,
                gender: data.gender,
                phone: data.phone
            });
            const internalPatientId = identity.internalPatientId;
            if (data.mrn) {
                this.mrnToInternalPatientId.set(`${raw.sourceSystemId}:${data.mrn}`, internalPatientId);
            }
            if (raw.sourceRecordId) {
                this.mrnToInternalPatientId.set(`${raw.sourceSystemId}:${raw.sourceRecordId}`, internalPatientId);
            }
            const existingPatient = await this.canonicalStore.getPatient(internalPatientId);
            const mpiIdentity = await this.mpi.getIdentity(internalPatientId);
            const canonicalPatient = {
                internalId: internalPatientId,
                givenName: data.givenName || existingPatient?.givenName || data.givenNameAr || '',
                familyName: data.familyName || existingPatient?.familyName || data.familyNameAr || '',
                givenNameAr: data.givenNameAr || existingPatient?.givenNameAr || data.givenName || '',
                familyNameAr: data.familyNameAr || existingPatient?.familyNameAr || data.familyName || '',
                gender: data.gender || existingPatient?.gender || 'unknown',
                birthDate: data.birthDate || existingPatient?.birthDate || '',
                nationality: data.nationality || existingPatient?.nationality || (data.iqamaNo ? 'مقيم' : 'سعودي'),
                nationalityCode: data.nationalityCode || existingPatient?.nationalityCode || (data.iqamaNo ? 'YEM' : 'SAU'),
                phone: data.phone || existingPatient?.phone || '+966501234567',
                religion: 'Islam',
                identifiers: mpiIdentity?.linkedIdentifiers || existingPatient?.identifiers || [],
                provenance,
                createdAt: existingPatient?.createdAt || timestamp,
                updatedAt: timestamp
            };
            await this.canonicalStore.savePatient(canonicalPatient);
            await this.provenanceService.recordProvenance({
                id: uuidv4(),
                targetEntityType: 'CanonicalPatient',
                targetEntityId: internalPatientId,
                sourceSystemId: raw.sourceSystemId,
                sourceRecordId: raw.sourceRecordId,
                rawRecordId: raw.id,
                adapterVersion: raw.adapterVersion,
                mappingConfigId: mapped.mappingConfigId,
                mappingVersion: mapped.mappingVersion,
                ingestedAt: raw.ingestedAt,
                transformedAt: timestamp,
                persistedAt: timestamp,
                validationScore: validation.score,
                validationDecision: validation.decision,
                activityDescription: `Resolved Master Patient Identity via MPI [${identity.matchStrategy}] with confidence ${identity.confidence * 100}%`
            });
            return { entityType: 'CanonicalPatient', internalId: internalPatientId, patientId: internalPatientId };
        }
        else if (mapped.targetCanonicalEntity === 'CanonicalCoverage') {
            const patientId = await this.resolvePatientId(raw.sourceSystemId, [data.sourcePatientMrn, data.sourcePatientRef, data.patientMrn]);
            if (!patientId) {
                throw new UnresolvedReferenceError(raw.sourceSystemId, raw.sourceRecordId, 'patient', String(data.sourcePatientMrn ?? data.sourcePatientRef ?? '(none provided)'));
            }
            const internalCovId = uuidv4();
            const canonicalCov = {
                internalId: internalCovId,
                patientId,
                payerId: data.payerId || 'CHI-INS-101',
                payerName: data.payerName || 'Bupa Arabia',
                payerNameAr: data.payerNameAr || 'بوبا العربية للتأمين التعاوني',
                policyNumber: data.policyNumber || raw.sourceRecordId,
                memberId: data.memberId || 'MEM-001',
                networkClass: data.networkClass?.includes('VIP') ? 'VIP' : 'Class A',
                copayPercentage: data.networkClass?.includes('VIP') ? 0 : 20,
                copayMaxCapSAR: data.networkClass?.includes('VIP') ? 0 : 100,
                annualMaxLimitSAR: 500000,
                period: {
                    start: data.period?.start || '2026-01-01',
                    end: data.period?.end || '2026-12-31'
                },
                status: 'active',
                provenance,
                createdAt: timestamp
            };
            const savedCovId = await this.canonicalStore.saveCoverage(canonicalCov);
            await this.provenanceService.recordProvenance({
                id: uuidv4(),
                targetEntityType: 'CanonicalCoverage',
                targetEntityId: savedCovId,
                sourceSystemId: raw.sourceSystemId,
                sourceRecordId: raw.sourceRecordId,
                rawRecordId: raw.id,
                adapterVersion: raw.adapterVersion,
                mappingConfigId: mapped.mappingConfigId,
                mappingVersion: mapped.mappingVersion,
                ingestedAt: raw.ingestedAt,
                transformedAt: timestamp,
                persistedAt: timestamp,
                validationScore: validation.score,
                validationDecision: validation.decision,
                activityDescription: `Normalized Insurance Coverage [${canonicalCov.payerNameAr} - ${canonicalCov.networkClass}]`
            });
            return { entityType: 'CanonicalCoverage', internalId: savedCovId, patientId };
        }
        else if (mapped.targetCanonicalEntity === 'CanonicalEncounter') {
            const patientId = await this.resolvePatientId(raw.sourceSystemId, [data.sourcePatientMrn, data.sourcePatientRef, data.sourcePatientId, data.patientMrn]);
            if (!patientId) {
                throw new UnresolvedReferenceError(raw.sourceSystemId, raw.sourceRecordId, 'patient', String(data.sourcePatientMrn ?? data.sourcePatientRef ?? '(none provided)'));
            }
            const internalEncounterId = uuidv4();
            const canonicalEncounter = {
                internalId: internalEncounterId,
                patientId,
                sourceVisitId: data.sourceVisitId,
                status: data.status || 'finished',
                class: data.class || 'outpatient',
                period: {
                    start: data.period?.start || timestamp,
                    end: data.period?.end
                },
                departmentAr: data.departmentAr || data.department,
                reasonTextAr: data.reasonTextAr || data.reasonText,
                provenance,
                createdAt: timestamp
            };
            const savedEncounterId = await this.canonicalStore.saveEncounter(canonicalEncounter);
            if (data.sourceVisitId) {
                this.visitToInternalEncounterId.set(`${raw.sourceSystemId}:${data.sourceVisitId}`, savedEncounterId);
            }
            await this.provenanceService.recordProvenance({
                id: uuidv4(),
                targetEntityType: 'CanonicalEncounter',
                targetEntityId: savedEncounterId,
                sourceSystemId: raw.sourceSystemId,
                sourceRecordId: raw.sourceRecordId,
                rawRecordId: raw.id,
                adapterVersion: raw.adapterVersion,
                mappingConfigId: mapped.mappingConfigId,
                mappingVersion: mapped.mappingVersion,
                ingestedAt: raw.ingestedAt,
                transformedAt: timestamp,
                persistedAt: timestamp,
                validationScore: validation.score,
                validationDecision: validation.decision,
                activityDescription: `Normalized Encounter from visit [${data.sourceVisitId}]`
            });
            return { entityType: 'CanonicalEncounter', internalId: savedEncounterId, patientId, encounterId: savedEncounterId };
        }
        else if (mapped.targetCanonicalEntity === 'CanonicalCondition') {
            const subject = await this.resolveClinicalSubject(raw.sourceSystemId, raw.sourceRecordId, data);
            const internalConditionId = uuidv4();
            const canonicalCondition = {
                internalId: internalConditionId,
                patientId: subject.patientId,
                encounterId: subject.encounterId,
                clinicalStatus: 'active',
                category: 'encounter-diagnosis',
                rank: data.rank || 'primary',
                code: data.code,
                recordedDate: data.recordedDate || timestamp,
                note: data.note,
                provenance,
                createdAt: timestamp
            };
            const savedConditionId = await this.canonicalStore.saveCondition(canonicalCondition);
            await this.provenanceService.recordProvenance({
                id: uuidv4(),
                targetEntityType: 'CanonicalCondition',
                targetEntityId: savedConditionId,
                sourceSystemId: raw.sourceSystemId,
                sourceRecordId: raw.sourceRecordId,
                rawRecordId: raw.id,
                adapterVersion: raw.adapterVersion,
                mappingConfigId: mapped.mappingConfigId,
                mappingVersion: mapped.mappingVersion,
                terminologyMapVersion: '1.0.0',
                ingestedAt: raw.ingestedAt,
                transformedAt: timestamp,
                persistedAt: timestamp,
                validationScore: validation.score,
                validationDecision: validation.decision,
                activityDescription: `Normalized Condition: '${data.code?.sourceCode}' -> SNOMED: ${data.code?.snomedCode || 'N/A'}, ICD-10-AM: ${data.code?.icd10amCode || 'N/A'}, SBS: ${data.code?.sbsCode || 'N/A'}`
            });
            return { entityType: 'CanonicalCondition', internalId: savedConditionId, patientId: subject.patientId, encounterId: subject.encounterId };
        }
        else if (mapped.targetCanonicalEntity === 'CanonicalObservation') {
            const subject = await this.resolveClinicalSubject(raw.sourceSystemId, raw.sourceRecordId, data);
            const internalObsId = uuidv4();
            const canonicalObs = {
                internalId: internalObsId,
                patientId: subject.patientId,
                encounterId: subject.encounterId,
                status: 'final',
                category: 'laboratory',
                code: data.code,
                effectiveDateTime: data.effectiveDateTime || timestamp,
                valueType: 'quantity',
                valueQuantity: data.valueQuantity,
                referenceRange: data.referenceRange,
                provenance,
                createdAt: timestamp
            };
            const savedObsId = await this.canonicalStore.saveObservation(canonicalObs);
            await this.provenanceService.recordProvenance({
                id: uuidv4(),
                targetEntityType: 'CanonicalObservation',
                targetEntityId: savedObsId,
                sourceSystemId: raw.sourceSystemId,
                sourceRecordId: raw.sourceRecordId,
                rawRecordId: raw.id,
                adapterVersion: raw.adapterVersion,
                mappingConfigId: mapped.mappingConfigId,
                mappingVersion: mapped.mappingVersion,
                terminologyMapVersion: '1.0.0',
                ingestedAt: raw.ingestedAt,
                transformedAt: timestamp,
                persistedAt: timestamp,
                validationScore: validation.score,
                validationDecision: validation.decision,
                activityDescription: `Normalized Lab Observation: '${data.code?.sourceCode}' -> LOINC: ${data.code?.loincCode || 'N/A'}`
            });
            return { entityType: 'CanonicalObservation', internalId: savedObsId, patientId: subject.patientId, encounterId: subject.encounterId };
        }
        else if (mapped.targetCanonicalEntity === 'CanonicalMedicationRequest') {
            const subject = await this.resolveClinicalSubject(raw.sourceSystemId, raw.sourceRecordId, data);
            const internalRxId = uuidv4();
            const canonicalRx = {
                internalId: internalRxId,
                patientId: subject.patientId,
                encounterId: subject.encounterId,
                status: 'active',
                intent: 'order',
                medication: data.medication,
                authoredOn: data.authoredOn || timestamp,
                dosageInstruction: data.dosageInstruction || [],
                dispenseRequest: data.dispenseRequest,
                provenance,
                createdAt: timestamp
            };
            const savedRxId = await this.canonicalStore.saveMedicationRequest(canonicalRx);
            await this.provenanceService.recordProvenance({
                id: uuidv4(),
                targetEntityType: 'CanonicalMedicationRequest',
                targetEntityId: savedRxId,
                sourceSystemId: raw.sourceSystemId,
                sourceRecordId: raw.sourceRecordId,
                rawRecordId: raw.id,
                adapterVersion: raw.adapterVersion,
                mappingConfigId: mapped.mappingConfigId,
                mappingVersion: mapped.mappingVersion,
                ingestedAt: raw.ingestedAt,
                transformedAt: timestamp,
                persistedAt: timestamp,
                validationScore: validation.score,
                validationDecision: validation.decision,
                activityDescription: `Normalized ePrescription [${canonicalRx.medication.code.sourceCode}] ➔ SFDA SDC: ${canonicalRx.medication.code.sfdaCode || 'N/A'} (${canonicalRx.medication.code.sfdaDisplay || ''})`
            });
            return { entityType: 'CanonicalMedicationRequest', internalId: savedRxId, patientId: subject.patientId, encounterId: subject.encounterId };
        }
        else if (mapped.targetCanonicalEntity === 'CanonicalImmunization') {
            const subject = await this.resolveClinicalSubject(raw.sourceSystemId, raw.sourceRecordId, data);
            const internalImmId = uuidv4();
            const canonicalImm = {
                internalId: internalImmId,
                patientId: subject.patientId,
                encounterId: subject.encounterId,
                status: 'completed',
                vaccineCode: data.vaccineCode,
                occurrenceDateTime: data.occurrenceDateTime || timestamp,
                lotNumber: data.lotNumber || 'LOT-MOH-2026',
                expirationDate: data.expirationDate || '2026-12-31',
                site: data.site || 'Left Deltoid',
                route: data.route || 'Intramuscular',
                provenance,
                createdAt: timestamp
            };
            const savedImmId = await this.canonicalStore.saveImmunization(canonicalImm);
            await this.provenanceService.recordProvenance({
                id: uuidv4(),
                targetEntityType: 'CanonicalImmunization',
                targetEntityId: savedImmId,
                sourceSystemId: raw.sourceSystemId,
                sourceRecordId: raw.sourceRecordId,
                rawRecordId: raw.id,
                adapterVersion: raw.adapterVersion,
                mappingConfigId: mapped.mappingConfigId,
                mappingVersion: mapped.mappingVersion,
                ingestedAt: raw.ingestedAt,
                transformedAt: timestamp,
                persistedAt: timestamp,
                validationScore: validation.score,
                validationDecision: validation.decision,
                activityDescription: `Normalized Immunization [${canonicalImm.vaccineCode.sourceCode}] ➔ Saudi MOH: ${canonicalImm.vaccineCode.sourceCode}, CVX: ${canonicalImm.vaccineCode.cvxCode || 'N/A'}`
            });
            return { entityType: 'CanonicalImmunization', internalId: savedImmId, patientId: subject.patientId, encounterId: subject.encounterId };
        }
        else if (mapped.targetCanonicalEntity === 'CanonicalClaim') {
            const subject = await this.resolveClinicalSubject(raw.sourceSystemId, raw.sourceRecordId, data);
            const patientId = subject.patientId;
            const encounterId = subject.encounterId || '';
            const coverages = await this.canonicalStore.getCoveragesByPatient(patientId);
            const coverage = coverages[0];
            const coverageId = coverage?.internalId || '';
            const internalClaimId = uuidv4();
            const canonicalClaim = {
                internalId: internalClaimId,
                patientId,
                encounterId,
                coverageId,
                serviceProviderId: data.serviceProviderId || 'HOSP-PROVIDER-01',
                claimType: data.claimType || 'professional',
                subType: data.subType || 'outpatient',
                use: 'claim',
                status: 'adjudicated',
                diagnoses: [
                    {
                        sequence: 1,
                        code: {
                            sourceCode: 'E11',
                            sourceSystem: 'urn:sa:nhic:icd-10-am',
                            icd10amCode: 'E11',
                            sbsCode: 'SBS-E11',
                            sourceDisplay: 'Type 2 diabetes mellitus'
                        },
                        type: 'principal'
                    }
                ],
                items: data.items || [],
                totalGrossSAR: data.totalGrossSAR || 300.0,
                totalPatientCopaySAR: data.totalPatientCopaySAR || 60.0,
                totalInsurerClaimedSAR: data.totalInsurerClaimedSAR || 240.0,
                batchNumber: `BATCH-KSA-2026-${Math.floor(100 + Math.random() * 900)}`,
                submissionDate: data.submissionDate || timestamp,
                provenance,
                createdAt: timestamp
            };
            const savedClaimId = await this.canonicalStore.saveClaim(canonicalClaim);
            // Real-time NPHIES Sandbox Adjudication.
            // The response is re-keyed to the surviving canonical claim id so that
            // idempotent re-runs update the same response instead of accumulating.
            const adjudicationResponse = await this.nphiesSimulator.adjudicateClaim(canonicalClaim, coverage);
            await this.canonicalStore.saveClaimResponse({ ...adjudicationResponse, claimId: savedClaimId, patientId, coverageId });
            await this.provenanceService.recordProvenance({
                id: uuidv4(),
                targetEntityType: 'CanonicalClaim',
                targetEntityId: savedClaimId,
                sourceSystemId: raw.sourceSystemId,
                sourceRecordId: raw.sourceRecordId,
                rawRecordId: raw.id,
                adapterVersion: raw.adapterVersion,
                mappingConfigId: mapped.mappingConfigId,
                mappingVersion: mapped.mappingVersion,
                ingestedAt: raw.ingestedAt,
                transformedAt: timestamp,
                persistedAt: timestamp,
                validationScore: validation.score,
                validationDecision: validation.decision,
                activityDescription: `Normalized eClaim & Adjudicated via NPHIES Sandbox [Tx: ${adjudicationResponse.nphiesTransactionId}] (Approved: ${adjudicationResponse.totalApprovedSAR} SAR, Patient Copay: ${adjudicationResponse.totalPatientCopaySAR} SAR)`
            });
            return { entityType: 'CanonicalClaim', internalId: savedClaimId, patientId, encounterId: subject.encounterId };
        }
        else if (mapped.targetCanonicalEntity === 'CanonicalAllergyIntolerance') {
            const patientId = await this.resolvePatientId(raw.sourceSystemId, [data.sourcePatientMrn, data.sourcePatientRef, data.patientMrn]);
            if (!patientId) {
                throw new UnresolvedReferenceError(raw.sourceSystemId, raw.sourceRecordId, 'patient', String(data.sourcePatientMrn ?? data.sourcePatientRef ?? '(none provided)'));
            }
            const internalAllergyId = uuidv4();
            const canonicalAllergy = {
                internalId: internalAllergyId,
                patientId,
                clinicalStatus: data.clinicalStatus || 'active',
                verificationStatus: data.verificationStatus || 'confirmed',
                type: data.type || 'allergy',
                category: data.category || 'medication',
                criticality: data.criticality || 'high',
                substanceCode: data.substanceCode || {
                    sourceCode: data.substanceText || 'Penicillin',
                    snomedCode: '764146007',
                    snomedDisplay: 'Penicillin'
                },
                substanceText: data.substanceText || 'Penicillin',
                substanceTextAr: data.substanceTextAr || 'بنسلين',
                reactions: data.reactions || [
                    {
                        manifestationText: 'Anaphylaxis',
                        manifestationTextAr: 'صدمة تحسسية حادة',
                        severity: 'severe'
                    }
                ],
                recordedDate: data.recordedDate || timestamp,
                provenance,
            };
            const savedAllergyId = await this.canonicalStore.saveAllergyIntolerance(canonicalAllergy);
            await this.provenanceService.recordProvenance({
                id: uuidv4(),
                targetEntityType: 'CanonicalAllergyIntolerance',
                targetEntityId: savedAllergyId,
                sourceSystemId: raw.sourceSystemId,
                sourceRecordId: raw.sourceRecordId,
                rawRecordId: raw.id,
                adapterVersion: raw.adapterVersion,
                mappingConfigId: mapped.mappingConfigId,
                mappingVersion: mapped.mappingVersion,
                ingestedAt: raw.ingestedAt,
                transformedAt: timestamp,
                persistedAt: timestamp,
                validationScore: validation.score,
                validationDecision: validation.decision,
                activityDescription: `Normalized Allergy Record [${canonicalAllergy.substanceTextAr || canonicalAllergy.substanceText}] ➔ SNOMED CT: ${canonicalAllergy.substanceCode?.snomedCode || 'N/A'} (Criticality: ${canonicalAllergy.criticality})`
            });
            return { entityType: 'CanonicalAllergyIntolerance', internalId: savedAllergyId, patientId };
        }
        else if (mapped.targetCanonicalEntity === 'CanonicalDiagnosticReport') {
            const subject = await this.resolveClinicalSubject(raw.sourceSystemId, raw.sourceRecordId, data);
            const patientId = subject.patientId;
            const encounterId = subject.encounterId;
            const observations = await this.canonicalStore.getObservationsByPatient(patientId);
            const internalReportId = uuidv4();
            const canonicalReport = {
                internalId: internalReportId,
                patientId,
                encounterId,
                status: data.status || 'final',
                category: data.category || 'LAB',
                code: data.code || {
                    sourceCode: '24323-8',
                    loincCode: '24323-8',
                    loincDisplay: 'Comprehensive metabolic 2000 panel - Serum or Plasma'
                },
                issued: data.issued || timestamp,
                resultObservationIds: observations.map(o => o.internalId),
                conclusion: data.conclusion,
                conclusionAr: data.conclusionAr,
                provenance
            };
            const savedReportId = await this.canonicalStore.saveDiagnosticReport(canonicalReport);
            await this.provenanceService.recordProvenance({
                id: uuidv4(),
                targetEntityType: 'CanonicalDiagnosticReport',
                targetEntityId: savedReportId,
                sourceSystemId: raw.sourceSystemId,
                sourceRecordId: raw.sourceRecordId,
                rawRecordId: raw.id,
                adapterVersion: raw.adapterVersion,
                mappingConfigId: mapped.mappingConfigId,
                mappingVersion: mapped.mappingVersion,
                ingestedAt: raw.ingestedAt,
                transformedAt: timestamp,
                persistedAt: timestamp,
                validationScore: validation.score,
                validationDecision: validation.decision,
                activityDescription: `Normalized Diagnostic Panel Report [${canonicalReport.code.loincDisplay || canonicalReport.code.sourceCode}] (Included Observations: ${canonicalReport.resultObservationIds.length})`
            });
            return { entityType: 'CanonicalDiagnosticReport', internalId: savedReportId, patientId, encounterId };
        }
        return { entityType: mapped.targetCanonicalEntity ?? 'Unknown', internalId: uuidv4() };
    }
    async checkPatientEligibility(patientId) {
        const coverages = await this.canonicalStore.getCoveragesByPatient(patientId);
        if (!coverages || coverages.length === 0)
            return null;
        return this.nphiesSimulator.checkEligibility(coverages[0]);
    }
    async reprocessRecord(rawRecordId, customConfig) {
        const raw = await this.rawStore.getById(rawRecordId);
        if (!raw)
            throw new Error(`Raw record ${rawRecordId} not found`);
        if (customConfig) {
            this.mappingEngine.registerConfiguration(customConfig);
        }
        await this.rawStore.markReprocessed(rawRecordId);
        const mapped = await this.mappingEngine.mapRecord(raw);
        const validation = await this.qualityEngine.validate(mapped);
        if (validation.decision !== 'REJECTED') {
            try {
                await this.persistToCanonical(mapped, raw, validation);
                await this.rawStore.updateStatus(rawRecordId, 'PERSISTED');
            }
            catch (err) {
                console.warn(`[reprocessRecord] ${err.message}`);
                await this.rawStore.updateStatus(rawRecordId, 'FAILED', err.message);
                return {
                    rawRecordId,
                    mapped,
                    validation: {
                        ...validation,
                        decision: 'REJECTED',
                        issues: [
                            ...(validation.issues || []),
                            { field: 'referential-link', severity: 'ERROR', rule: 'REFERENTIAL_INTEGRITY', message: err.message, sourceValue: '' }
                        ]
                    }
                };
            }
        }
        return {
            rawRecordId,
            mapped,
            validation
        };
    }
    async getIntegrationMonitoringStats() {
        const rawStats = await this.rawStore.getStats();
        const patients = await this.canonicalStore.getAllPatients();
        const encounters = await this.canonicalStore.getAllEncounters();
        const conditions = await this.canonicalStore.getAllConditions();
        const observations = await this.canonicalStore.getAllObservations();
        const coverages = await this.canonicalStore.getAllCoverages();
        const claims = await this.canonicalStore.getAllClaims();
        const medications = await this.canonicalStore.getAllMedicationRequests();
        const immunizations = await this.canonicalStore.getAllImmunizations();
        const allergies = await this.canonicalStore.getAllAllergies();
        const diagnosticReports = await this.canonicalStore.getAllDiagnosticReports();
        const provenanceList = await this.provenanceService.getAllProvenance();
        const recentAudit = await this.provenanceService.getAuditLog(15);
        const dynamicHospitals = this.dynamicRegistry.getAllHospitals().filter(h => !/(demo|test|mock|fake|sample|example)/i.test(`${h.hospitalId} ${h.hospitalName} ${h.hospitalNameAr}`));
        const adapterStatuses = [];
        for (const adapter of this.adapters.values()) {
            const status = await adapter.healthCheck();
            const isDemo = /(demo|test|mock|fake|sample|example)/i.test(`${status.systemId}`);
            if (isDemo)
                continue;
            status.extractedRecordCount = rawStats.bySystem[status.systemId] || 0;
            adapterStatuses.push(status);
        }
        return {
            overview: {
                rawRecordsCount: rawStats.totalRecords,
                canonicalPatientsCount: patients.length,
                canonicalEncountersCount: encounters.length,
                canonicalConditionsCount: conditions.length,
                canonicalObservationsCount: observations.length,
                canonicalCoveragesCount: coverages.length,
                canonicalClaimsCount: claims.length,
                canonicalMedicationsCount: medications.length,
                canonicalImmunizationsCount: immunizations.length,
                canonicalAllergiesCount: allergies.length,
                canonicalDiagnosticReportsCount: diagnosticReports.length,
                provenanceRecordsCount: provenanceList.length,
                dynamicHospitalsCount: dynamicHospitals.length
            },
            sources: adapterStatuses,
            dynamicHospitals,
            rawStats,
            recentAudit
        };
    }
}
//# sourceMappingURL=normalization-engine.js.map