import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
export class PrismaMpiService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma || new PrismaClient();
    }
    normalizeArabic(text) {
        if (!text)
            return '';
        return text
            .trim()
            .toLowerCase()
            .replace(/[\u064B-\u065F]/g, '')
            .replace(/[إأآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/\s+/g, ' ');
    }
    mapIdentityToDomain(dbId) {
        return {
            internalPatientId: dbId.id,
            status: dbId.status,
            mergedInto: dbId.merged_into,
            linkedIdentifiers: dbId.mpi_identifiers.map((i) => ({
                value: i.value,
                type: i.type,
                system: i.system,
                sourceSystemId: i.source_system_id,
                isActive: i.is_active,
                firstSeenAt: i.first_seen_at.toISOString()
            })),
            demographicProfile: {
                givenNameNormalized: dbId.given_name_norm,
                familyNameNormalized: dbId.family_name_norm,
                birthDate: dbId.birth_date,
                gender: dbId.gender,
                phoneNormalized: dbId.phone_norm
            },
            matchHistory: dbId.match_history.map((m) => ({
                matchedIdentifier: m.matched_identifier,
                matchStrategy: m.match_strategy,
                confidence: m.confidence,
                matchedAt: m.matched_at.toISOString(),
                matchedBy: m.matched_by,
                decision: m.decision,
                details: m.details
            })),
            createdAt: dbId.created_at.toISOString(),
            lastUpdatedAt: dbId.last_updated_at.toISOString()
        };
    }
    async resolvePatientIdentity(input) {
        const timestamp = new Date();
        // 1. DETERMINISTIC: Exact National ID
        if (input.nationalId && input.nationalId.trim()) {
            const nid = input.nationalId.trim();
            const match = await this.prisma.internalPatientIdentity.findFirst({
                where: {
                    status: 'ACTIVE',
                    mpi_identifiers: { some: { type: 'NID', value: nid } }
                },
                include: { mpi_identifiers: true, match_history: true }
            });
            if (match) {
                await this.linkNewIdentifiers(match, input, 'NID_EXACT', 1.0, timestamp);
                return {
                    internalPatientId: match.id,
                    isNewPatient: false,
                    confidence: 1.0,
                    matchStrategy: 'NID_EXACT',
                    linkedIdentifiersCount: match.mpi_identifiers.length
                };
            }
        }
        // 2. DETERMINISTIC: Exact Iqama
        if (input.iqamaNo && input.iqamaNo.trim()) {
            const iqama = input.iqamaNo.trim();
            const match = await this.prisma.internalPatientIdentity.findFirst({
                where: {
                    status: 'ACTIVE',
                    mpi_identifiers: { some: { type: 'IQAMA', value: iqama } }
                },
                include: { mpi_identifiers: true, match_history: true }
            });
            if (match) {
                await this.linkNewIdentifiers(match, input, 'IQAMA_EXACT', 1.0, timestamp);
                return {
                    internalPatientId: match.id,
                    isNewPatient: false,
                    confidence: 1.0,
                    matchStrategy: 'IQAMA_EXACT',
                    linkedIdentifiersCount: match.mpi_identifiers.length
                };
            }
        }
        // 3. PROBABILISTIC: Demographics
        const normGiven = this.normalizeArabic(input.givenNameAr || input.givenName);
        const normFamily = this.normalizeArabic(input.familyNameAr || input.familyName);
        const dob = input.birthDate;
        if (normGiven && normFamily && dob) {
            const match = await this.prisma.internalPatientIdentity.findFirst({
                where: {
                    status: 'ACTIVE',
                    given_name_norm: normGiven,
                    family_name_norm: normFamily,
                    birth_date: dob,
                    ...(input.gender ? { gender: input.gender } : {})
                },
                include: { mpi_identifiers: true, match_history: true }
            });
            if (match) {
                await this.linkNewIdentifiers(match, input, 'DEMOGRAPHIC_EXACT', 0.95, timestamp);
                return {
                    internalPatientId: match.id,
                    isNewPatient: false,
                    confidence: 0.95,
                    matchStrategy: 'DEMOGRAPHIC_EXACT',
                    linkedIdentifiersCount: match.mpi_identifiers.length
                };
            }
        }
        // 4. NO MATCH: Create New
        const newInternalId = input.nationalId && input.nationalId.trim()
            ? `pat-nid-${input.nationalId.trim()}`
            : input.iqamaNo && input.iqamaNo.trim()
                ? `pat-iqama-${input.iqamaNo.trim()}`
                : uuidv4();
        const newIdentifiers = [];
        if (input.nationalId) {
            newIdentifiers.push({
                value: input.nationalId.trim(),
                type: 'NID',
                system: 'urn:sa:nid',
                source_system_id: input.sourceSystemId,
                is_active: true,
                first_seen_at: timestamp
            });
        }
        if (input.iqamaNo) {
            newIdentifiers.push({
                value: input.iqamaNo.trim(),
                type: 'IQAMA',
                system: 'urn:sa:iqama',
                source_system_id: input.sourceSystemId,
                is_active: true,
                first_seen_at: timestamp
            });
        }
        if (input.mrn) {
            newIdentifiers.push({
                value: input.mrn.trim(),
                type: 'MRN',
                system: `urn:${input.sourceSystemId}:mrn`,
                source_system_id: input.sourceSystemId,
                is_active: true,
                first_seen_at: timestamp
            });
        }
        await this.prisma.internalPatientIdentity.create({
            data: {
                id: newInternalId,
                status: 'ACTIVE',
                given_name_norm: normGiven,
                family_name_norm: normFamily,
                birth_date: input.birthDate || '',
                gender: input.gender || '',
                phone_norm: input.phone?.replace(/\D/g, ''),
                created_at: timestamp,
                last_updated_at: timestamp,
                mpi_identifiers: {
                    create: newIdentifiers
                },
                match_history: {
                    create: [{
                            match_strategy: 'MANUAL',
                            confidence: 1.0,
                            matched_at: timestamp,
                            matched_by: 'SYSTEM_INITIAL_INGEST',
                            decision: 'AUTO_LINKED',
                            details: `Initial identity created from source system [${input.sourceSystemId}]`
                        }]
                }
            }
        });
        return {
            internalPatientId: newInternalId,
            isNewPatient: true,
            confidence: 1.0,
            matchStrategy: 'INITIAL_REGISTRATION',
            linkedIdentifiersCount: newIdentifiers.length
        };
    }
    async linkNewIdentifiers(identity, input, strategy, confidence, timestamp) {
        const newIdentifiers = [];
        if (input.mrn) {
            const exists = identity.mpi_identifiers.some((id) => id.type === 'MRN' && id.value === input.mrn && id.source_system_id === input.sourceSystemId);
            if (!exists) {
                newIdentifiers.push({
                    value: input.mrn.trim(),
                    type: 'MRN',
                    system: `urn:${input.sourceSystemId}:mrn`,
                    source_system_id: input.sourceSystemId,
                    is_active: true,
                    first_seen_at: timestamp
                });
            }
        }
        if (input.nationalId) {
            const exists = identity.mpi_identifiers.some((id) => id.type === 'NID' && id.value === input.nationalId);
            if (!exists) {
                newIdentifiers.push({
                    value: input.nationalId.trim(),
                    type: 'NID',
                    system: 'urn:sa:nid',
                    source_system_id: input.sourceSystemId,
                    is_active: true,
                    first_seen_at: timestamp
                });
            }
        }
        await this.prisma.internalPatientIdentity.update({
            where: { id: identity.id },
            data: {
                last_updated_at: timestamp,
                mpi_identifiers: { create: newIdentifiers },
                match_history: {
                    create: {
                        matched_identifier: input.nationalId || input.iqamaNo || input.mrn,
                        match_strategy: strategy,
                        confidence,
                        matched_at: timestamp,
                        matched_by: 'MPI_MATCH_ENGINE',
                        decision: 'AUTO_LINKED',
                        details: `Matched and linked record from source [${input.sourceSystemId}] with MRN [${input.mrn || 'N/A'}]`
                    }
                }
            }
        });
    }
    async getIdentity(internalPatientId) {
        const id = await this.prisma.internalPatientIdentity.findUnique({
            where: { id: internalPatientId },
            include: { mpi_identifiers: true, match_history: true }
        });
        return id ? this.mapIdentityToDomain(id) : null;
    }
    async findByIdentifier(type, value) {
        const id = await this.prisma.internalPatientIdentity.findFirst({
            where: {
                status: 'ACTIVE',
                mpi_identifiers: { some: { type: type, value: value } }
            },
            include: { mpi_identifiers: true, match_history: true }
        });
        return id ? this.mapIdentityToDomain(id) : null;
    }
    async getAllIdentities() {
        const ids = await this.prisma.internalPatientIdentity.findMany({
            include: { mpi_identifiers: true, match_history: true }
        });
        return ids.map(id => this.mapIdentityToDomain(id));
    }
    async mergePatientIdentities(survivorId, obsoleteId, reason, adminUser = 'HIE_ADMIN') {
        // We implement the Prisma transaction for merging.
        const survivor = await this.prisma.internalPatientIdentity.findUnique({
            where: { id: survivorId },
            include: { mpi_identifiers: true }
        });
        const obsolete = await this.prisma.internalPatientIdentity.findUnique({
            where: { id: obsoleteId },
            include: { mpi_identifiers: true }
        });
        if (!survivor)
            throw new Error(`Survivor identity not found.`);
        if (!obsolete)
            throw new Error(`Obsolete identity not found.`);
        const timestamp = new Date();
        const newIdentifiersForSurvivor = obsolete.mpi_identifiers.filter(obsId => !survivor.mpi_identifiers.some(s => s.type === obsId.type && s.value === obsId.value && s.source_system_id === obsId.source_system_id)).map(obsId => ({
            value: obsId.value,
            type: obsId.type,
            system: obsId.system,
            source_system_id: obsId.source_system_id,
            is_active: true,
            first_seen_at: timestamp
        }));
        await this.prisma.$transaction([
            this.prisma.internalPatientIdentity.update({
                where: { id: survivorId },
                data: {
                    last_updated_at: timestamp,
                    mpi_identifiers: { create: newIdentifiersForSurvivor },
                    match_history: {
                        create: {
                            match_strategy: 'MANUAL',
                            confidence: 1.0,
                            matched_at: timestamp,
                            matched_by: adminUser,
                            decision: 'MANUAL_LINKED',
                            details: `Merged obsolete identity [${obsoleteId}] into [${survivorId}]. Reason: ${reason}`
                        }
                    }
                }
            }),
            this.prisma.internalPatientIdentity.update({
                where: { id: obsoleteId },
                data: {
                    status: 'MERGED',
                    merged_into: survivorId,
                    last_updated_at: timestamp,
                    match_history: {
                        create: {
                            match_strategy: 'MANUAL',
                            confidence: 1.0,
                            matched_at: timestamp,
                            matched_by: adminUser,
                            decision: 'MANUAL_LINKED',
                            details: `Identity merged into [${survivorId}] by [${adminUser}]. Reason: ${reason}`
                        }
                    }
                }
            })
        ]);
        return { success: true };
    }
    async unmergePatientIdentities(survivorId, obsoleteId, reason, adminUser = 'HIE_ADMIN') {
        // simplified for brevity
        const timestamp = new Date();
        await this.prisma.$transaction([
            this.prisma.internalPatientIdentity.update({
                where: { id: obsoleteId },
                data: {
                    status: 'ACTIVE',
                    merged_into: null,
                    last_updated_at: timestamp,
                    match_history: {
                        create: {
                            match_strategy: 'MANUAL',
                            confidence: 1.0,
                            matched_at: timestamp,
                            matched_by: adminUser,
                            decision: 'AUTO_LINKED',
                            details: `Identity unmerged and restored from [${survivorId}]. Reason: ${reason}`
                        }
                    }
                }
            }),
            this.prisma.internalPatientIdentity.update({
                where: { id: survivorId },
                data: {
                    last_updated_at: timestamp,
                    match_history: {
                        create: {
                            match_strategy: 'MANUAL',
                            confidence: 1.0,
                            matched_at: timestamp,
                            matched_by: adminUser,
                            decision: 'REJECTED',
                            details: `Unmerged identity [${obsoleteId}] from [${survivorId}]. Reason: ${reason}`
                        }
                    }
                }
            })
        ]);
        return { success: true };
    }
    async findDuplicateCandidates() {
        // Doing true N^2 matching in SQL is slow, we'll fetch all and do in memory just for prototype parity
        const activeIdentities = await this.prisma.internalPatientIdentity.findMany({
            where: { status: 'ACTIVE' }
        });
        const candidates = [];
        for (let i = 0; i < activeIdentities.length; i++) {
            for (let j = i + 1; j < activeIdentities.length; j++) {
                const p1 = activeIdentities[i];
                const p2 = activeIdentities[j];
                let nameScore = 0;
                if (p1.given_name_norm && p2.given_name_norm && p1.family_name_norm && p2.family_name_norm) {
                    const givenMatch = p1.given_name_norm === p2.given_name_norm ? 0.5 : 0;
                    const familyMatch = p1.family_name_norm === p2.family_name_norm ? 0.5 : 0;
                    nameScore = givenMatch + familyMatch;
                }
                const dobScore = (p1.birth_date && p2.birth_date && p1.birth_date === p2.birth_date) ? 1.0 : 0;
                const genderScore = (p1.gender && p2.gender && p1.gender === p2.gender) ? 1.0 : 0;
                const phoneScore = (p1.phone_norm && p2.phone_norm && p1.phone_norm === p2.phone_norm) ? 1.0 : 0;
                const totalConfidence = (nameScore * 0.4) + (dobScore * 0.3) + (genderScore * 0.1) + (phoneScore * 0.2);
                if (totalConfidence >= 0.70) {
                    candidates.push({
                        id: `DUP-${p1.id.substring(0, 4)}-${p2.id.substring(0, 4)}`,
                        patientId1: p1.id,
                        patientId2: p2.id,
                        confidence: Math.round(totalConfidence * 100) / 100,
                        scoreBreakdown: { nameScore, dobScore, genderScore, phoneScore },
                        status: 'PENDING_REVIEW',
                        flaggedAt: new Date().toISOString()
                    });
                }
            }
        }
        return candidates;
    }
    async clearAll() {
        await this.prisma.internalPatientIdentity.deleteMany();
    }
}
//# sourceMappingURL=prisma-mpi-service.js.map