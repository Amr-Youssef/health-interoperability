import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';
import { prisma } from '../../lib/prisma.js';

const SUCCESS_STATUSES = ['PERSISTED', 'VALIDATED'];
const FAILED_STATUSES = ['FAILED'];
const QUARANTINE_STATUSES = ['QUARANTINED'];

function toPublicRecord(r: any) {
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
    lastReprocessedAt: r.last_reprocessed_at ? r.last_reprocessed_at.toISOString() : null,
    validationScore: r.validation_score ?? null,
    validationDecision: r.validation_decision || null,
    validationIssuesCount: r.validation_issues_count || 0,
    mappingVersion: r.mapping_version || null,
    mappingConfigId: r.mapping_config_id || null,
    terminologySummary: r.terminology_summary ? JSON.parse(r.terminology_summary) : null,
    mpiStrategy: r.mpi_strategy || null,
    mpiConfidence: r.mpi_confidence ?? null,
    mpiIdentityId: r.mpi_identity_id || null
  };
}

function inferChannel(r: { payload_format?: string; source_system_id?: string; adapter_version?: string }): string {
  const fmt = String(r.payload_format || '').toLowerCase();
  const sys = String(r.source_system_id || '').toLowerCase();
  const adv = String(r.adapter_version || '').toLowerCase();
  if (fmt.includes('fhir')) return 'FHIR';
  if (fmt.includes('hl7') || sys.includes('hl7') || adv.includes('hl7')) return 'HL7';
  if (fmt.includes('json') || fmt.includes('file') || fmt.includes('csv')) return 'File';
  if (fmt.includes('relational')) return 'API';
  return 'API';
}

function connectorStatus(args: { total: number; failed: number; lastSync: Date | null; disabled: boolean }): { status: string; errorRate: number } {
  const { total, failed, lastSync, disabled } = args;
  const errorRate = total > 0 ? failed / total : 0;
  if (disabled) return { status: 'Disabled', errorRate };
  if (total === 0) return { status: 'Disconnected', errorRate };
  if (lastSync) {
    const hours = (Date.now() - lastSync.getTime()) / 3600000;
    if (hours > 24) return { status: 'Disconnected', errorRate };
    if (errorRate >= 0.2) return { status: 'Degraded', errorRate };
    return { status: 'Connected', errorRate };
  }
  return { status: 'Disconnected', errorRate };
}

async function measureProbeLatency(sysId: string): Promise<number | null> {
  try {
    const t0 = performance.now();
    await prisma.rawRecord.findFirst({ where: { source_system_id: sysId }, orderBy: { ingested_at: 'desc' }, select: { id: true } });
    return Math.max(1, Math.round(performance.now() - t0));
  } catch { return null; }
}

export function createAuditRoutes(engine: any) {
  const router = Router();
  const READ = requirePermission('AUDIT_READ_CENTRAL') as any;

  // National integration overview — counts only, no PHI.
  // Quarantine = QUARANTINED (manual-review isolation), never conflated with FAILED.
  router.get('/audit/integration-overview', verifyToken as any, READ, async (_req, res) => {
    try {
      const [total, success, failed, quarantined, systems] = await Promise.all([
        prisma.rawRecord.count(),
        prisma.rawRecord.count({ where: { processing_status: { in: SUCCESS_STATUSES } } }),
        prisma.rawRecord.count({ where: { processing_status: { in: FAILED_STATUSES } } }),
        prisma.rawRecord.count({ where: { processing_status: { in: QUARANTINE_STATUSES } } }),
        prisma.rawRecord.groupBy({ by: ['source_system_id'] })
      ]);
      const lastSuccess = await prisma.rawRecord.findFirst({
        where: { processing_status: { in: SUCCESS_STATUSES } },
        orderBy: { ingested_at: 'desc' },
        select: { ingested_at: true, source_system_id: true }
      });
      const latencies: number[] = [];
      for (const s of systems as any[]) {
        const ms = await measureProbeLatency((s as any).source_system_id);
        if (ms != null) latencies.push(ms);
      }
      const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
      const failureRate = total > 0 ? failed / total : 0;
      res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
      res.json({
        received: total,
        succeeded: success,
        failed,
        failureRate,
        quarantine: quarantined,
        avgLatencyMs: avgLatency,
        lastSuccessAt: lastSuccess?.ingested_at ? lastSuccess.ingested_at.toISOString() : null,
        lastSuccessSystem: lastSuccess?.source_system_id || null
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Per-connector audit view — derived from stored records only; latency is measured per system
  router.get('/audit/connectors', verifyToken as any, READ, async (_req, res) => {
    try {
      const systems = await prisma.rawRecord.groupBy({ by: ['source_system_id'] });
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [byStatus, todayCounts, dynamicHospitals, orgs] = await Promise.all([
        prisma.rawRecord.groupBy({ by: ['source_system_id', 'processing_status'], _count: { processing_status: true } }),
        prisma.rawRecord.groupBy({ by: ['source_system_id'], where: { ingested_at: { gte: today } }, _count: { source_system_id: true } }),
        (async () => { try { return await engine?.dynamicRegistry?.getAllHospitals?.() || []; } catch { return []; } })(),
        prisma.organization.findMany({ select: { id: true, organization_name: true, organization_name_ar: true, organization_type: true, status: true } })
      ]);
      const dynById = new Map((dynamicHospitals || []).map((h: any) => [h.hospitalId, h]));
      const orgById = new Map(orgs.map((o: any) => [o.id, o]));
      const connectors = [];
      for (const s of systems) {
        const sysId: string = (s as any).source_system_id;
        const t0 = performance.now();
        const rows = (byStatus as any[]).filter(r => r.source_system_id === sysId);
        const total = rows.reduce((a, r) => a + (r._count?.processing_status || 0), 0);
        const failed = rows.filter(r => FAILED_STATUSES.includes(r.processing_status)).reduce((a, r) => a + (r._count?.processing_status || 0), 0);
        const quarantined = rows.filter(r => QUARANTINE_STATUSES.includes(r.processing_status)).reduce((a, r) => a + (r._count?.processing_status || 0), 0);
        const todayRow: any = (todayCounts as any[]).find(r => r.source_system_id === sysId);
        const latest: any = await prisma.rawRecord.findFirst({ where: { source_system_id: sysId }, orderBy: { ingested_at: 'desc' } });
        const latestSuccess: any = await prisma.rawRecord.findFirst({ where: { source_system_id: sysId, processing_status: { in: SUCCESS_STATUSES } }, orderBy: { ingested_at: 'desc' }, select: { ingested_at: true, id: true } });
        const latestFailed: any = await prisma.rawRecord.findFirst({ where: { source_system_id: sysId, processing_status: { in: FAILED_STATUSES } }, orderBy: { ingested_at: 'desc' }, select: { ingested_at: true, error_message: true } });
        const latencyMs = Math.max(1, Math.round(performance.now() - t0));
        const lastSync = latest?.ingested_at || null;
        const orgMatch = orgById.get(sysId);
        const disabled = !!orgMatch && (orgMatch as any).status !== 'ACTIVE';
        const { status, errorRate } = connectorStatus({ total, failed, lastSync, disabled });
        const dyn: any = dynById.get(sysId);
        connectors.push({
          systemId: sysId,
          name: dyn?.hospitalNameAr || dyn?.hospitalName || (orgMatch as any)?.organization_name_ar || (orgMatch as any)?.organization_name || sysId,
          nameEn: dyn?.hospitalName || (orgMatch as any)?.organization_name || sysId,
          status,
          disabled,
          lastSyncAt: lastSync ? lastSync.toISOString() : null,
          lastSuccessAt: latestSuccess?.ingested_at ? latestSuccess.ingested_at.toISOString() : null,
          lastErrorAt: latestFailed?.ingested_at ? latestFailed.ingested_at.toISOString() : null,
          lastErrorMessage: latestFailed?.error_message || null,
          todayCount: (todayRow as any)?._count?.source_system_id || 0,
          totalCount: total,
          errorCount: failed,
          errorRate,
          quarantinedCount: quarantined,
          latencyMs,
          latencyMeasured: true,
          channel: inferChannel({ payload_format: latest?.payload_format, source_system_id: sysId, adapter_version: latest?.adapter_version }),
          adapterVersion: latest?.adapter_version || null,
          mappingVersion: (await prisma.provenanceRecord.findFirst({ where: { source_system_id: sysId }, orderBy: { persisted_at: 'desc' }, select: { mapping_version: true } }).catch(() => null))?.mapping_version || null
        });
      }
      connectors.sort((a, b) => b.totalCount - a.totalCount);
      res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
      res.json({ items: connectors, total: connectors.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Paginated raw records — metadata + stored trace columns, no payload
  router.get('/audit/records', verifyToken as any, READ, async (req, res) => {
    try {
      const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '15'), 10) || 15, 5), 50);
      const skip = (page - 1) * limit;
      const where: any = {};
      if (req.query.hospital) where.source_system_id = String(req.query.hospital);
      if (req.query.status) where.processing_status = String(req.query.status);
      if (req.query.messageType) where.source_entity_type = { equals: String(req.query.messageType), mode: 'insensitive' };
      if (req.query.result === 'success') where.processing_status = { in: SUCCESS_STATUSES };
      if (req.query.result === 'failed') where.processing_status = { in: FAILED_STATUSES };
      if (req.query.result === 'quarantined') where.processing_status = { in: QUARANTINE_STATUSES };
      if (req.query.from || req.query.to) {
        where.ingested_at = {};
        if (req.query.from) where.ingested_at.gte = new Date(String(req.query.from));
        if (req.query.to) where.ingested_at.lte = new Date(String(req.query.to));
      }
      const [total, rows] = await Promise.all([
        prisma.rawRecord.count({ where }),
        prisma.rawRecord.findMany({
          where,
          orderBy: { ingested_at: 'desc' },
          skip, take: limit,
          select: { id: true, source_system_id: true, source_entity_type: true, source_record_id: true, payload_format: true, adapter_version: true, ingested_at: true, batch_id: true, processing_status: true, error_message: true, reprocess_count: true, last_reprocessed_at: true, validation_score: true, validation_decision: true, validation_issues_count: true, mapping_version: true, mapping_config_id: true, terminology_summary: true, mpi_strategy: true, mpi_confidence: true, mpi_identity_id: true }
        })
      ]);
      res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
      res.json({ items: rows.map(toPublicRecord), total, page, pageSize: limit, totalPages: Math.ceil(total / limit) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Single-record pipeline trace — stored stage outcomes only, honest gaps labeled
  router.get('/audit/records/:id/trace', verifyToken as any, READ, async (req, res) => {
    try {
      const raw: any = await prisma.rawRecord.findUnique({ where: { id: String(req.params.id) } });
      if (!raw) return res.status(404).json({ error: 'Record not found' });
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
        reprocessCount: raw.reprocess_count || 0,
        validationScore: raw.validation_score ?? null,
        validationDecision: raw.validation_decision || null,
        validationIssuesCount: raw.validation_issues_count || 0,
        mappingVersion: raw.mapping_version || null,
        mappingConfigId: raw.mapping_config_id || null,
        terminologySummary: raw.terminology_summary ? JSON.parse(raw.terminology_summary) : null,
        mpiStrategy: raw.mpi_strategy || null,
        mpiConfidence: raw.mpi_confidence ?? null,
        mpiIdentityId: raw.mpi_identity_id || null
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
      const term = record.terminologySummary as any;
      const stages = [
        { stage: 'Source', result: record.sourceSystemId ? 'recorded' : 'unknown', detail: record.sourceSystemId },
        { stage: 'Raw Event', result: 'recorded', detail: `${record.sourceEntityType} • ${record.batchId}` },
        { stage: 'Adapter', result: record.adapterVersion ? 'recorded' : 'unknown', detail: record.adapterVersion || 'غير مسجل' },
        { stage: 'Mapping', result: record.mappingVersion ? 'recorded' : 'unknown', detail: record.mappingVersion ? `${record.mappingVersion}${record.mappingConfigId ? ' • ' + record.mappingConfigId : ''}` : 'لا يوجد إصدار ربط مسجل لهذا السجل' },
        { stage: 'Terminology', result: term ? 'recorded' : 'unknown', detail: term ? `${term.conceptCount} مفهوم • ${(term.systems || []).join('، ')} • خريطة ${term.mapVersion || '—'}` : 'لا توجد نتيجة مصطلحات مسجلة لهذا السجل' },
        { stage: 'Validation', result: FAILED_STATUSES.includes(record.processingStatus) ? 'failed' : record.processingStatus === 'QUARANTINED' ? 'quarantined' : record.validationDecision ? (record.validationDecision === 'REJECTED' ? 'failed' : 'passed') : (SUCCESS_STATUSES.includes(record.processingStatus) ? 'passed' : 'pending'), detail: record.validationDecision ? `${record.validationDecision} • درجة ${record.validationScore ?? '—'} • ${record.validationIssuesCount} ملاحظة` : (record.errorMessage || record.processingStatus) },
        { stage: 'MPI', result: record.mpiStrategy ? 'recorded' : 'unknown', detail: record.mpiStrategy ? `${record.mpiStrategy} • ثقة ${record.mpiConfidence != null ? Math.round(record.mpiConfidence * 100) + '%' : '—'}${record.mpiIdentityId ? ' • ' + record.mpiIdentityId : ''}` : 'لا يوجد قرار MPI مسجل لهذا السجل' },
        { stage: 'Canonical', result: persisted ? 'persisted' : 'unknown', detail: provenance[0] ? `${provenance[0].target_entity_type}:${provenance[0].target_entity_id}` : 'غير مؤكد' },
        { stage: 'FHIR', result: 'on-demand', detail: 'يُولد عند الطلب عبر FHIR R4 ولا يُخزن' }
      ];
      res.json({ record, provenance, auditLogs, stages });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Audit evidence export — single record bundle (JSON)
  router.get('/audit/evidence/:id', verifyToken as any, READ, async (req, res) => {
    try {
      const raw: any = await prisma.rawRecord.findUnique({ where: { id: String(req.params.id) } });
      if (!raw) return res.status(404).json({ error: 'Record not found' });
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
        exportedBy: (req as any).user?.id || null,
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
          reprocessCount: raw.reprocess_count || 0,
          validationScore: raw.validation_score ?? null,
          validationDecision: raw.validation_decision || null,
          validationIssuesCount: raw.validation_issues_count || 0,
          mappingVersion: raw.mapping_version || null,
          mappingConfigId: raw.mapping_config_id || null,
          terminologySummary: raw.terminology_summary ? JSON.parse(raw.terminology_summary) : null,
          mpiStrategy: raw.mpi_strategy || null,
          mpiConfidence: raw.mpi_confidence ?? null,
          mpiIdentityId: raw.mpi_identity_id || null
        },
        provenance,
        auditLogs
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  return router;
}
