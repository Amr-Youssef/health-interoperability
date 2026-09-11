import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';
import { prisma } from '../../lib/prisma.js';
const SUCCESS_STATUSES = ['PERSISTED', 'VALIDATED'];
const FAILED_STATUSES = ['FAILED'];
function toPublicRecord(r) {
    return {
        id: r.id,
        sourceSystemId: r.source_system_id,
        sourceEntityType: r.source_entity_type,
        sourceRecordId: r.source_record_id,
        payloadFormat: r.payload_format,
        adapterVersion: r.adapter_version,
        ingestedAt: r.ingested_at ? r.ingested_at.toISOString() : null,
        batchId: r.batch_id,
        processingStatus: r.processing_status,
        errorMessage: r.error_message || null,
        reprocessCount: r.reprocess_count || 0,
        lastReprocessedAt: r.last_reprocessed_at ? r.last_reprocessed_at.toISOString() : null
    };
}
function inferChannel(r) {
    const fmt = String(r.payload_format || '').toLowerCase();
    const sys = String(r.source_system_id || '').toLowerCase();
    const adv = String(r.adapter_version || '').toLowerCase();
    if (fmt.includes('fhir'))
        return 'FHIR';
    if (fmt.includes('hl7') || sys.includes('hl7') || adv.includes('hl7'))
        return 'HL7';
    if (fmt.includes('json') || fmt.includes('file') || fmt.includes('csv'))
        return 'File';
    if (fmt.includes('relational'))
        return 'API';
    return 'API';
}
function connectorStatus(args) {
    const { total, failed, lastSync, disabled } = args;
    const errorRate = total > 0 ? failed / total : 0;
    if (disabled)
        return { status: 'Disabled', errorRate };
    if (total === 0)
        return { status: 'Disconnected', errorRate };
    if (lastSync) {
        const hours = (Date.now() - lastSync.getTime()) / 3600000;
        if (hours > 24)
            return { status: 'Disconnected', errorRate };
        if (errorRate >= 0.2)
            return { status: 'Degraded', errorRate };
        return { status: 'Connected', errorRate };
    }
    return { status: 'Disconnected', errorRate };
}
export function createAuditRoutes(engine) {
    const router = Router();
    const READ = requirePermission('AUDIT_READ_CENTRAL');
    // National integration overview — counts only, no PHI
    router.get('/audit/integration-overview', verifyToken, READ, async (_req, res) => {
        try {
            const [total, success, failed] = await Promise.all([
                prisma.rawRecord.count(),
                prisma.rawRecord.count({ where: { processing_status: { in: SUCCESS_STATUSES } } }),
                prisma.rawRecord.count({ where: { processing_status: { in: FAILED_STATUSES } } })
            ]);
            const lastSuccess = await prisma.rawRecord.findFirst({
                where: { processing_status: { in: SUCCESS_STATUSES } },
                orderBy: { ingested_at: 'desc' },
                select: { ingested_at: true, source_system_id: true }
            });
            let avgLatency = null;
            try {
                const latencies = [];
                for (const adapter of engine?.adapters?.values?.() || []) {
                    try {
                        const h = await adapter.healthCheck();
                        if (typeof h?.latencyMs === 'number')
                            latencies.push(h.latencyMs);
                    }
                    catch { }
                }
                if (latencies.length)
                    avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
            }
            catch { }
            const failureRate = total > 0 ? failed / total : 0;
            res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
            res.json({
                received: total,
                succeeded: success,
                failed,
                failureRate,
                quarantine: failed,
                avgLatencyMs: avgLatency,
                lastSuccessAt: lastSuccess?.ingested_at ? lastSuccess.ingested_at.toISOString() : null,
                lastSuccessSystem: lastSuccess?.source_system_id || null
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // Per-connector audit view — derived from stored records only
    router.get('/audit/connectors', verifyToken, READ, async (_req, res) => {
        try {
            const systems = await prisma.rawRecord.groupBy({ by: ['source_system_id'] });
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const [byStatus, todayCounts, dynamicHospitals, orgs] = await Promise.all([
                prisma.rawRecord.groupBy({ by: ['source_system_id', 'processing_status'], _count: { processing_status: true } }),
                prisma.rawRecord.groupBy({ by: ['source_system_id'], where: { ingested_at: { gte: today } }, _count: { source_system_id: true } }),
                (async () => { try {
                    return await engine?.dynamicRegistry?.getAllHospitals?.() || [];
                }
                catch {
                    return [];
                } })(),
                prisma.organization.findMany({ select: { id: true, organization_name: true, organization_name_ar: true, organization_type: true, status: true } })
            ]);
            const dynById = new Map((dynamicHospitals || []).map((h) => [h.hospitalId, h]));
            const orgById = new Map(orgs.map((o) => [o.id, o]));
            const connectors = [];
            for (const s of systems) {
                const sysId = s.source_system_id;
                const rows = byStatus.filter(r => r.source_system_id === sysId);
                const total = rows.reduce((a, r) => a + (r._count?.processing_status || 0), 0);
                const failed = rows.filter(r => FAILED_STATUSES.includes(r.processing_status)).reduce((a, r) => a + (r._count?.processing_status || 0), 0);
                const todayRow = todayCounts.find(r => r.source_system_id === sysId);
                const latest = await prisma.rawRecord.findFirst({ where: { source_system_id: sysId }, orderBy: { ingested_at: 'desc' } });
                const latestSuccess = await prisma.rawRecord.findFirst({ where: { source_system_id: sysId, processing_status: { in: SUCCESS_STATUSES } }, orderBy: { ingested_at: 'desc' }, select: { ingested_at: true, id: true } });
                const latestFailed = await prisma.rawRecord.findFirst({ where: { source_system_id: sysId, processing_status: { in: FAILED_STATUSES } }, orderBy: { ingested_at: 'desc' }, select: { ingested_at: true, error_message: true } });
                const lastSync = latest?.ingested_at || null;
                const orgMatch = orgById.get(sysId);
                const disabled = !!orgMatch && orgMatch.status !== 'ACTIVE';
                const { status, errorRate } = connectorStatus({ total, failed, lastSync, disabled });
                const dyn = dynById.get(sysId);
                connectors.push({
                    systemId: sysId,
                    name: dyn?.hospitalNameAr || dyn?.hospitalName || orgMatch?.organization_name_ar || orgMatch?.organization_name || sysId,
                    nameEn: dyn?.hospitalName || orgMatch?.organization_name || sysId,
                    status,
                    disabled,
                    lastSyncAt: lastSync ? lastSync.toISOString() : null,
                    lastSuccessAt: latestSuccess?.ingested_at ? latestSuccess.ingested_at.toISOString() : null,
                    lastErrorAt: latestFailed?.ingested_at ? latestFailed.ingested_at.toISOString() : null,
                    lastErrorMessage: latestFailed?.error_message || null,
                    todayCount: todayRow?._count?.source_system_id || 0,
                    totalCount: total,
                    errorCount: failed,
                    errorRate,
                    latencyMs: null,
                    channel: inferChannel({ payload_format: latest?.payload_format, source_system_id: sysId, adapter_version: latest?.adapter_version }),
                    adapterVersion: latest?.adapter_version || null,
                    mappingVersion: (await prisma.provenanceRecord.findFirst({ where: { source_system_id: sysId }, orderBy: { persisted_at: 'desc' }, select: { mapping_version: true } }).catch(() => null))?.mapping_version || null
                });
            }
            connectors.sort((a, b) => b.totalCount - a.totalCount);
            res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
            res.json({ items: connectors, total: connectors.length });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // Paginated raw records — metadata only, no payload
    router.get('/audit/records', verifyToken, READ, async (req, res) => {
        try {
            const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
            const limit = Math.min(Math.max(parseInt(String(req.query.limit || '15'), 10) || 15, 5), 50);
            const skip = (page - 1) * limit;
            const where = {};
            if (req.query.hospital)
                where.source_system_id = String(req.query.hospital);
            if (req.query.status)
                where.processing_status = String(req.query.status);
            if (req.query.messageType)
                where.source_entity_type = { equals: String(req.query.messageType), mode: 'insensitive' };
            if (req.query.result === 'success')
                where.processing_status = { in: SUCCESS_STATUSES };
            if (req.query.result === 'failed')
                where.processing_status = { in: FAILED_STATUSES };
            if (req.query.from || req.query.to) {
                where.ingested_at = {};
                if (req.query.from)
                    where.ingested_at.gte = new Date(String(req.query.from));
                if (req.query.to)
                    where.ingested_at.lte = new Date(String(req.query.to));
            }
            const [total, rows] = await Promise.all([
                prisma.rawRecord.count({ where }),
                prisma.rawRecord.findMany({
                    where,
                    orderBy: { ingested_at: 'desc' },
                    skip, take: limit,
                    select: { id: true, source_system_id: true, source_entity_type: true, source_record_id: true, payload_format: true, adapter_version: true, ingested_at: true, batch_id: true, processing_status: true, error_message: true, reprocess_count: true, last_reprocessed_at: true }
                })
            ]);
            res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
            res.json({ items: rows.map(toPublicRecord), total, page, pageSize: limit, totalPages: Math.ceil(total / limit) });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // Single-record pipeline trace — real stored stages only
    router.get('/audit/records/:id/trace', verifyToken, READ, async (req, res) => {
        try {
            const raw = await prisma.rawRecord.findUnique({ where: { id: String(req.params.id) } });
            if (!raw)
                return res.status(404).json({ error: 'Record not found' });
            const record = {
                id: raw.id,
                sourceSystemId: raw.source_system_id,
                sourceEntityType: raw.source_entity_type,
                sourceRecordId: raw.source_record_id,
                payloadFormat: raw.payload_format,
                adapterVersion: raw.adapter_version,
                ingestedAt: raw.ingested_at.toISOString(),
                batchId: raw.batch_id,
                checksum: raw.checksum,
                processingStatus: raw.processing_status,
                errorMessage: raw.error_message || null,
                reprocessCount: raw.reprocess_count || 0
            };
            const provenance = await prisma.provenanceRecord.findMany({
                where: { source_system_id: raw.source_system_id, source_record_id: raw.source_record_id },
                orderBy: { persisted_at: 'desc' },
                take: 10
            });
            const auditLogs = await prisma.auditLog.findMany({
                where: { OR: [{ entity_id: raw.id }, { entity_id: raw.source_record_id }] },
                orderBy: { created_at: 'desc' },
                take: 20,
                select: { id: true, entity_type: true, entity_id: true, action: true, actor_id: true, details: true, created_at: true }
            });
            const persisted = provenance.length > 0;
            const stages = [
                { stage: 'Source', result: record.sourceSystemId ? 'recorded' : 'unknown', detail: record.sourceSystemId },
                { stage: 'Raw Event', result: 'recorded', detail: `${record.sourceEntityType} • ${record.batchId}` },
                { stage: 'Adapter', result: record.adapterVersion ? 'recorded' : 'unknown', detail: record.adapterVersion || 'غير مسجل' },
                { stage: 'Mapping', result: provenance[0] ? 'recorded' : 'unknown', detail: provenance[0]?.mapping_version || 'لا يوجد Provenance مطابق' },
                { stage: 'Terminology', result: 'unknown', detail: 'نتائج المصطلحات غير مخزنة لكل سجل في قاعدة البيانات' },
                { stage: 'Validation', result: FAILED_STATUSES.includes(record.processingStatus) ? 'failed' : SUCCESS_STATUSES.includes(record.processingStatus) ? 'passed' : 'pending', detail: record.errorMessage || record.processingStatus },
                { stage: 'MPI', result: persisted ? 'recorded' : 'unknown', detail: persisted ? `${provenance.length} هدف محفوظ` : 'لا يوجد Provenance مطابق' },
                { stage: 'Canonical', result: persisted ? 'persisted' : 'unknown', detail: provenance[0] ? `${provenance[0].target_entity_type}:${provenance[0].target_entity_id}` : 'غير مؤكد' },
                { stage: 'FHIR', result: 'on-demand', detail: 'يُولد عند الطلب عبر FHIR R4 ولا يُخزن' }
            ];
            res.json({ record, provenance, auditLogs, stages });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // Audit evidence export — single record bundle (JSON)
    router.get('/audit/evidence/:id', verifyToken, READ, async (req, res) => {
        try {
            const raw = await prisma.rawRecord.findUnique({ where: { id: String(req.params.id) } });
            if (!raw)
                return res.status(404).json({ error: 'Record not found' });
            const provenance = await prisma.provenanceRecord.findMany({
                where: { source_system_id: raw.source_system_id, source_record_id: raw.source_record_id },
                orderBy: { persisted_at: 'desc' },
                take: 10
            });
            const auditLogs = await prisma.auditLog.findMany({
                where: { OR: [{ entity_id: raw.id }, { entity_id: raw.source_record_id }] },
                orderBy: { created_at: 'desc' },
                take: 20
            });
            res.json({
                exportedAt: new Date().toISOString(),
                exportedBy: req.user?.id || null,
                record: {
                    id: raw.id,
                    sourceSystemId: raw.source_system_id,
                    sourceEntityType: raw.source_entity_type,
                    sourceRecordId: raw.source_record_id,
                    payloadFormat: raw.payload_format,
                    adapterVersion: raw.adapter_version,
                    ingestedAt: raw.ingested_at.toISOString(),
                    batchId: raw.batch_id,
                    checksumSha256: raw.checksum,
                    processingStatus: raw.processing_status,
                    errorMessage: raw.error_message || null,
                    reprocessCount: raw.reprocess_count || 0
                },
                provenance,
                auditLogs
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    return router;
}
//# sourceMappingURL=audit.routes.js.map