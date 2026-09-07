import { prisma as defaultPrisma } from '../../lib/prisma.js';
export class PrismaRawStore {
    prisma;
    constructor(prisma) {
        this.prisma = prisma || defaultPrisma;
    }
    toDomain(record) {
        return {
            id: record.id,
            sourceSystemId: record.source_system_id,
            sourceEntityType: record.source_entity_type,
            sourceRecordId: record.source_record_id,
            payload: JSON.parse(record.payload),
            payloadFormat: record.payload_format,
            adapterVersion: record.adapter_version,
            ingestedAt: record.ingested_at.toISOString(),
            batchId: record.batch_id,
            checksum: record.checksum,
            processingStatus: record.processing_status,
            errorMessage: record.error_message || undefined,
            reprocessCount: record.reprocess_count,
            lastReprocessedAt: record.last_reprocessed_at ? record.last_reprocessed_at.toISOString() : undefined
        };
    }
    async save(record) {
        const existing = await this.prisma.rawRecord.findUnique({
            where: {
                source_system_id_source_entity_type_source_record_id: {
                    source_system_id: record.sourceSystemId,
                    source_entity_type: record.sourceEntityType,
                    source_record_id: record.sourceRecordId
                }
            }
        });
        if (existing) {
            await this.prisma.rawRecord.update({
                where: { id: existing.id },
                data: {
                    payload: JSON.stringify(record.payload),
                    payload_format: record.payloadFormat,
                    adapter_version: record.adapterVersion,
                    ingested_at: new Date(record.ingestedAt),
                    batch_id: record.batchId,
                    checksum: record.checksum,
                    processing_status: record.processingStatus,
                    error_message: record.errorMessage || null
                }
            });
            record.id = existing.id; // ensure caller has correct ID
        }
        else {
            await this.prisma.rawRecord.create({
                data: {
                    id: record.id,
                    source_system_id: record.sourceSystemId,
                    source_entity_type: record.sourceEntityType,
                    source_record_id: record.sourceRecordId,
                    payload: JSON.stringify(record.payload),
                    payload_format: record.payloadFormat,
                    adapter_version: record.adapterVersion,
                    ingested_at: new Date(record.ingestedAt),
                    batch_id: record.batchId,
                    checksum: record.checksum,
                    processing_status: record.processingStatus,
                    error_message: record.errorMessage || null
                }
            });
        }
    }
    async saveBatch(records) {
        await this.prisma.$transaction(records.map(r => this.prisma.rawRecord.upsert({
            where: { source_system_id_source_entity_type_source_record_id: { source_system_id: r.sourceSystemId, source_entity_type: r.sourceEntityType, source_record_id: r.sourceRecordId } },
            update: {
                payload: JSON.stringify(r.payload),
                payload_format: r.payloadFormat,
                adapter_version: r.adapterVersion,
                ingested_at: new Date(r.ingestedAt),
                batch_id: r.batchId,
                checksum: r.checksum,
                processing_status: r.processingStatus,
                error_message: r.errorMessage || null,
            },
            create: {
                id: r.id,
                source_system_id: r.sourceSystemId,
                source_entity_type: r.sourceEntityType,
                source_record_id: r.sourceRecordId,
                payload: JSON.stringify(r.payload),
                payload_format: r.payloadFormat,
                adapter_version: r.adapterVersion,
                ingested_at: new Date(r.ingestedAt),
                batch_id: r.batchId,
                checksum: r.checksum,
                processing_status: r.processingStatus,
                error_message: r.errorMessage || null,
                reprocess_count: r.reprocessCount || 0,
                last_reprocessed_at: r.lastReprocessedAt ? new Date(r.lastReprocessedAt) : null
            }
        })));
    }
    async getById(id) {
        const record = await this.prisma.rawRecord.findUnique({ where: { id } });
        return record ? this.toDomain(record) : null;
    }
    async findBySource(sourceSystemId, entityType) {
        const where = { source_system_id: { equals: sourceSystemId, mode: 'insensitive' } };
        if (entityType) {
            where.source_entity_type = { equals: entityType, mode: 'insensitive' };
        }
        const records = await this.prisma.rawRecord.findMany({
            where,
            orderBy: { ingested_at: 'desc' }
        });
        return records.map(r => this.toDomain(r));
    }
    async findPending(sourceSystemId) {
        const where = {
            processing_status: { in: ['PENDING', 'REPROCESSED'] }
        };
        if (sourceSystemId) {
            where.source_system_id = sourceSystemId;
        }
        const records = await this.prisma.rawRecord.findMany({
            where,
            orderBy: { ingested_at: 'desc' }
        });
        return records.map(r => this.toDomain(r));
    }
    async updateStatus(id, status, errorMessage) {
        await this.prisma.rawRecord.update({
            where: { id },
            data: { processing_status: status, error_message: errorMessage || null }
        });
    }
    async markReprocessed(id) {
        await this.prisma.rawRecord.update({
            where: { id },
            data: {
                processing_status: 'PENDING',
                reprocess_count: { increment: 1 },
                last_reprocessed_at: new Date(),
                error_message: null
            }
        });
    }
    async getStats() {
        const total = await this.prisma.rawRecord.count();
        const bySystemData = await this.prisma.rawRecord.groupBy({
            by: ['source_system_id'],
            _count: { source_system_id: true }
        });
        const bySystem = {};
        bySystemData.forEach(d => bySystem[d.source_system_id] = d._count.source_system_id);
        const byStatusData = await this.prisma.rawRecord.groupBy({
            by: ['processing_status'],
            _count: { processing_status: true }
        });
        const byStatus = {};
        byStatusData.forEach(d => byStatus[d.processing_status] = d._count.processing_status);
        const byEntityTypeData = await this.prisma.rawRecord.groupBy({
            by: ['source_system_id', 'source_entity_type'],
            _count: { source_entity_type: true }
        });
        const byEntityType = {};
        byEntityTypeData.forEach(d => {
            byEntityType[`${d.source_system_id}:${d.source_entity_type}`] = d._count.source_entity_type;
        });
        return {
            totalRecords: total,
            bySystem,
            byStatus,
            byEntityType
        };
    }
    async getAll() {
        const records = await this.prisma.rawRecord.findMany({
            orderBy: { ingested_at: 'desc' }
        });
        return records.map(r => this.toDomain(r));
    }
    async clearAll() {
        await this.prisma.rawRecord.deleteMany();
    }
}
//# sourceMappingURL=prisma-raw-store.js.map