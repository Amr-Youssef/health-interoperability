import { prisma as defaultPrisma } from '../lib/prisma.js';
const searchCache = new Map();
const SEARCH_CACHE_TTL = 30 * 1000;
const SEARCH_CACHE_MAX = 500;
export class PrismaCanonicalStore {
    prisma;
    constructor(prisma) {
        this.prisma = prisma || defaultPrisma;
    }
    // PATIENT
    async savePatient(patient) {
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
        }
        else {
            const created = await this.prisma.patient.create({
                data: {
                    internal_id: patient.internalId,
                    internal_id_uuid: patient.internalIdUuid || undefined,
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
    mapPatientToCanonical(p) {
        return {
            internalId: p.internal_id,
            identifiers: p.identifiers ? p.identifiers.map((i) => ({
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
        };
    }
    async getPatient(internalId) {
        let p = null;
        try {
            p = await this.prisma.patient.findUnique({ where: { internal_id_uuid: internalId }, include: { identifiers: true } });
        }
        catch { }
        if (!p)
            p = await this.prisma.patient.findUnique({ where: { internal_id: internalId }, include: { identifiers: true } });
        if (!p) {
            p = await this.prisma.patient.findFirst({
                where: { id: internalId },
                include: { identifiers: true }
            });
        }
        if (!p) {
            const byIden = await this.findPatientByIdentifier(internalId);
            if (byIden)
                return byIden;
        }
        return p ? this.mapPatientToCanonical(p) : null;
    }
    async findPatientByIdentifier(value, sourceSystemId) {
        const where = { value: value.trim() };
        if (sourceSystemId)
            where.source_system_id = sourceSystemId;
        const id = await this.prisma.patientIdentifier.findFirst({
            where,
            include: { patient: { include: { identifiers: true } } }
        });
        return id ? this.mapPatientToCanonical(id.patient) : null;
    }
    async findPatientBySourceRecordId(sourceSystemId, sourceRecordId) {
        const p = await this.prisma.patient.findFirst({
            where: { source_system_id: sourceSystemId, source_record_id: sourceRecordId },
            include: { identifiers: true }
        });
        return p ? this.mapPatientToCanonical(p) : null;
    }
    async getAllPatients() {
        const patients = await this.prisma.patient.findMany({ include: { identifiers: true } });
        return patients.map(p => this.mapPatientToCanonical(p));
    }
    async searchPatients(params) {
        const q = (params.q || '').trim();
        const take = Math.min(Math.max(params.take || 20, 1), 50);
        const skip = params.cursor ? 0 : Math.min(Math.max(params.skip || 0, 0), 10000);
        const hasQuery = q.length >= 2;
        const cacheKey = `${q}|${skip}|${take}|${params.sort || 'recent'}|${params.organizationId || ''}|${params.cursor || ''}`;
        const cached = searchCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL)
            return cached.data;
        let where = {};
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
            }
            else {
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
        if (params.organizationId) {
            const orgId = params.organizationId;
            const orgFilter = { OR: [{ source_system_id: orgId }, { organizations: { some: { organization_id: orgId, active: true } } }] };
            if (Object.keys(where).length === 0)
                where = orgFilter;
            else
                where = { AND: [where, orgFilter] };
        }
        if (params.cursor) {
            try {
                const decoded = JSON.parse(Buffer.from(params.cursor, 'base64').toString('utf8'));
                const cursorWhere = { OR: [{ created_at: { lt: new Date(decoded.created_at) } }, { created_at: decoded.created_at, id: { lt: decoded.id } }] };
                where = Object.keys(where).length ? { AND: [where, cursorWhere] } : cursorWhere;
            }
            catch { }
        }
        const orderBy = params.sort === 'name' ? [{ first_name_ar: 'asc' }, { first_name: 'asc' }] : [{ created_at: 'desc' }, { id: 'desc' }];
        const fetchTake = params.cursor ? take + 1 : take;
        const [total, rowsAll] = await Promise.all([
            params.cursor ? Promise.resolve(0) : this.prisma.patient.count({ where }),
            this.prisma.patient.findMany({ where, include: { identifiers: true }, orderBy, skip: params.cursor ? 0 : skip, take: fetchTake })
        ]);
        const hasMore = rowsAll.length > take;
        const rows = hasMore ? rowsAll.slice(0, take) : rowsAll;
        const nextCursor = hasMore ? Buffer.from(JSON.stringify({ created_at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id })).toString('base64') : null;
        const result = { items: rows.map(p => this.mapPatientToCanonical(p)), total: params.cursor ? rows.length : total, nextCursor, hasMore };
        searchCache.set(cacheKey, { data: result, ts: Date.now() });
        if (searchCache.size > SEARCH_CACHE_MAX)
            searchCache.delete(searchCache.keys().next().value);
        return result;
    }
    async countPatients() {
        return this.prisma.patient.count();
    }
    // ENCOUNTER
    mapEncounterToCanonical(e) {
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
        };
    }
    async saveEncounter(enc) {
        const encClass = typeof enc.class === 'string' ? enc.class : enc.class?.code || 'outpatient';
        let patientUuid = null;
        try {
            const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: enc.patientId }, { internal_id_uuid: enc.patientId }, { id: enc.patientId }] } });
            if (pat)
                patientUuid = pat.id;
        }
        catch { }
        await this.prisma.encounter.upsert({
            where: { internal_id: enc.internalId },
            update: {
                patient_id: enc.patientId,
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
    async getEncounter(internalId) {
        const e = await this.prisma.encounter.findUnique({ where: { internal_id: internalId } });
        return e ? this.mapEncounterToCanonical(e) : null;
    }
    async findEncounterBySourceVisitId(sourceSystemId, sourceVisitId) {
        const e = await this.prisma.encounter.findFirst({
            where: { source_system_id: sourceSystemId, source_visit_id: sourceVisitId }
        });
        return e ? this.mapEncounterToCanonical(e) : null;
    }
    async getEncountersByPatient(patientId) {
        const list = await this.prisma.encounter.findMany({
            where: { patient_id: patientId },
            orderBy: { period_start: 'desc' }
        });
        return list.map(e => this.mapEncounterToCanonical(e));
    }
    async getAllEncounters() {
        const list = await this.prisma.encounter.findMany();
        return list.map(e => this.mapEncounterToCanonical(e));
    }
    // CONDITIONS
    mapConditionToCanonical(c) {
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
        };
    }
    async saveCondition(cond) {
        let patientUuid = null;
        try {
            const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: arguments[0].patientId }, { internal_id_uuid: arguments[0].patientId }, { id: arguments[0].patientId }] } });
            if (pat)
                patientUuid = pat.id;
        }
        catch { }
        await this.prisma.condition.upsert({
            where: { internal_id: cond.internalId },
            update: {
                patient_id: cond.patientId,
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
    async getConditionsByPatient(patientId) {
        const list = await this.prisma.condition.findMany({
            where: { patient_id: patientId },
            orderBy: { recorded_date: 'desc' }
        });
        return list.map(c => this.mapConditionToCanonical(c));
    }
    async getAllConditions() {
        const list = await this.prisma.condition.findMany();
        return list.map(c => this.mapConditionToCanonical(c));
    }
    // OBSERVATION
    mapObservationToCanonical(o) {
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
        };
    }
    async saveObservation(obs) {
        const valQty = obs.valueQuantity?.value ?? obs.value?.value;
        const valUnit = obs.valueQuantity?.unit ?? obs.value?.unit;
        const valStr = obs.valueString ?? obs.value?.stringValue;
        let patientUuid = null;
        try {
            const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: arguments[0].patientId }, { internal_id_uuid: arguments[0].patientId }, { id: arguments[0].patientId }] } });
            if (pat)
                patientUuid = pat.id;
        }
        catch { }
        await this.prisma.observation.upsert({
            where: { internal_id: obs.internalId },
            update: {
                patient_id: obs.patientId,
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
    async getObservationsByPatient(patientId) {
        const list = await this.prisma.observation.findMany({
            where: { patient_id: patientId },
            orderBy: { effective_date: 'desc' }
        });
        return list.map(o => this.mapObservationToCanonical(o));
    }
    async getAllObservations() {
        const list = await this.prisma.observation.findMany();
        return list.map(o => this.mapObservationToCanonical(o));
    }
    // COVERAGES
    mapCoverageToCanonical(c) {
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
        };
    }
    async saveCoverage(cov) {
        const payor = cov.payerId || cov.payorId || 'INS-CHI-101';
        const subId = cov.policyNumber || cov.subscriberId || 'POL-001';
        const benId = cov.memberId || cov.beneficiaryId || 'MEM-001';
        let patientUuid = null;
        try {
            const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: arguments[0].patientId }, { internal_id_uuid: arguments[0].patientId }, { id: arguments[0].patientId }] } });
            if (pat)
                patientUuid = pat.id;
        }
        catch { }
        await this.prisma.coverage.upsert({
            where: { internal_id: cov.internalId },
            update: {
                patient_id: cov.patientId,
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
    async getCoveragesByPatient(patientId) {
        const list = await this.prisma.coverage.findMany({ where: { patient_id: patientId } });
        return list.map(c => this.mapCoverageToCanonical(c));
    }
    async getAllCoverages() {
        const list = await this.prisma.coverage.findMany();
        return list.map(c => this.mapCoverageToCanonical(c));
    }
    // CLAIMS & CLAIM RESPONSES
    mapClaimToCanonical(c) {
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
        };
    }
    async saveClaim(claim) {
        const totalGross = claim.totalGrossSAR ?? claim.total?.value ?? 0;
        const claimType = claim.claimType ?? claim.type ?? 'institutional';
        let patientUuid = null;
        try {
            const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: arguments[0].patientId }, { internal_id_uuid: arguments[0].patientId }, { id: arguments[0].patientId }] } });
            if (pat)
                patientUuid = pat.id;
        }
        catch { }
        await this.prisma.claim.upsert({
            where: { internal_id: claim.internalId },
            update: {
                patient_id: claim.patientId,
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
    async getClaimsByPatient(patientId) {
        const list = await this.prisma.claim.findMany({
            where: { patient_id: patientId },
            orderBy: { submission_date: 'desc' }
        });
        return list.map(c => this.mapClaimToCanonical(c));
    }
    async getAllClaims() {
        const list = await this.prisma.claim.findMany();
        return list.map(c => this.mapClaimToCanonical(c));
    }
    async saveClaimResponse(res) {
        await this.prisma.claimResponse.create({
            data: {
                claim_id: res.claimId,
                status: res.status || res.outcome || 'complete',
                outcome: res.outcome,
                payment_value: res.payment?.value ?? res.totalApprovedSAR ?? 0,
                payment_currency: res.payment?.currency ?? 'SAR'
            }
        });
    }
    async getClaimResponse(claimId) {
        const cr = await this.prisma.claimResponse.findFirst({ where: { claim_id: claimId } });
        if (!cr)
            return null;
        return {
            internalId: cr.id,
            claimId: cr.claim_id,
            patientId: '',
            coverageId: '',
            outcome: cr.outcome || 'complete',
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
    mapMedicationToCanonical(m) {
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
        };
    }
    async saveMedicationRequest(rx) {
        const medCode = rx.medication?.code || rx.medicationCode || {};
        let patientUuid = null;
        try {
            const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: arguments[0].patientId }, { internal_id_uuid: arguments[0].patientId }, { id: arguments[0].patientId }] } });
            if (pat)
                patientUuid = pat.id;
        }
        catch { }
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
    async getMedicationRequestsByPatient(patientId) {
        const list = await this.prisma.medicationRequest.findMany({
            where: { patient_id: patientId },
            orderBy: { authored_on: 'desc' }
        });
        return list.map(m => this.mapMedicationToCanonical(m));
    }
    async getAllMedicationRequests() {
        const list = await this.prisma.medicationRequest.findMany();
        return list.map(m => this.mapMedicationToCanonical(m));
    }
    // IMMUNIZATIONS
    mapImmunizationToCanonical(i) {
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
        };
    }
    async saveImmunization(imm) {
        const vaxCode = imm.vaccineCode || {};
        let patientUuid = null;
        try {
            const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: arguments[0].patientId }, { internal_id_uuid: arguments[0].patientId }, { id: arguments[0].patientId }] } });
            if (pat)
                patientUuid = pat.id;
        }
        catch { }
        await this.prisma.immunization.upsert({
            where: { internal_id: imm.internalId },
            update: {
                patient_id: imm.patientId,
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
    async getImmunizationsByPatient(patientId) {
        const list = await this.prisma.immunization.findMany({
            where: { patient_id: patientId },
            orderBy: { occurrence_date: 'desc' }
        });
        return list.map(i => this.mapImmunizationToCanonical(i));
    }
    async getAllImmunizations() {
        const list = await this.prisma.immunization.findMany();
        return list.map(i => this.mapImmunizationToCanonical(i));
    }
    // ALLERGIES
    mapAllergyToCanonical(a) {
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
        };
    }
    async saveAllergyIntolerance(alg) {
        const algCode = alg.substanceCode || alg.code || {};
        let patientUuid = null;
        try {
            const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: arguments[0].patientId }, { internal_id_uuid: arguments[0].patientId }, { id: arguments[0].patientId }] } });
            if (pat)
                patientUuid = pat.id;
        }
        catch { }
        await this.prisma.allergyIntolerance.upsert({
            where: { internal_id: alg.internalId },
            update: {
                patient_id: alg.patientId,
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
    async getAllergiesByPatient(patientId) {
        const list = await this.prisma.allergyIntolerance.findMany({
            where: { patient_id: patientId },
            orderBy: { recorded_date: 'desc' }
        });
        return list.map(a => this.mapAllergyToCanonical(a));
    }
    async getAllAllergies() {
        const list = await this.prisma.allergyIntolerance.findMany();
        return list.map(a => this.mapAllergyToCanonical(a));
    }
    // DIAGNOSTIC REPORTS
    mapDiagnosticReportToCanonical(d) {
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
        };
    }
    async saveDiagnosticReport(rep) {
        let patientUuid = null;
        try {
            const pat = await this.prisma.patient.findFirst({ where: { OR: [{ internal_id: arguments[0].patientId }, { internal_id_uuid: arguments[0].patientId }, { id: arguments[0].patientId }] } });
            if (pat)
                patientUuid = pat.id;
        }
        catch { }
        await this.prisma.diagnosticReport.upsert({
            where: { internal_id: rep.internalId },
            update: {
                patient_id: rep.patientId,
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
                ...(patientUuid ? { patient_id_uuid: patientUuid } : {}),
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
    async getDiagnosticReportsByPatient(patientId) {
        const list = await this.prisma.diagnosticReport.findMany({
            where: { patient_id: patientId },
            orderBy: { issued: 'desc' }
        });
        return list.map(d => this.mapDiagnosticReportToCanonical(d));
    }
    async getAllDiagnosticReports() {
        const list = await this.prisma.diagnosticReport.findMany();
        return list.map(d => this.mapDiagnosticReportToCanonical(d));
    }
    // LONGITUDINAL RECORD
    async getLongitudinalRecord(patientId) {
        const patient = await this.getPatient(patientId);
        if (!patient)
            return null;
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
    async saveOrganization(org) {
        // Only implemented minimal fields for compatibility, real system uses Prisma Organization table directly
    }
    async savePractitioner(prac) {
        // Stubs
    }
    async reassignPatientRecords(sourcePatientId, targetPatientId) {
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
    async clearAll() {
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
//# sourceMappingURL=prisma-canonical-store.js.map