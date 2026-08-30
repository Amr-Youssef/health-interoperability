import { PrismaClient } from '@prisma/client';
import { ProvenanceRecord, AuditEntry } from '../core/domain/provenance.js';
import { v4 as uuidv4 } from 'uuid';

export class PrismaProvenanceService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async recordProvenance(record: ProvenanceRecord): Promise<void> {
    await this.prisma.provenanceRecord.upsert({
      where: { id: record.id },
      update: {
        target_entity_type: record.targetEntityType,
        target_entity_id: record.targetEntityId,
        source_system_id: record.sourceSystemId,
        source_record_id: record.sourceRecordId,
        mapping_version: record.mappingVersion,
        adapter_version: record.adapterVersion,
        persisted_at: record.persistedAt ? new Date(record.persistedAt) : undefined
      },
      create: {
        id: record.id,
        target_entity_type: record.targetEntityType,
        target_entity_id: record.targetEntityId,
        source_system_id: record.sourceSystemId,
        source_record_id: record.sourceRecordId,
        mapping_version: record.mappingVersion,
        adapter_version: record.adapterVersion,
        persisted_at: record.persistedAt ? new Date(record.persistedAt) : undefined
      }
    });
    
    // Auto-record audit log
    await this.recordAudit({
      id: record.id,
      timestamp: record.persistedAt,
      action: 'PERSISTED',
      entityType: record.targetEntityType,
      entityId: record.targetEntityId,
      actor: 'NORMALIZATION_ENGINE',
      detail: `Persisted ${record.targetEntityType} from [${record.sourceSystemId}:${record.sourceRecordId}] using mapping v${record.mappingVersion}`
    });
  }

  async getProvenanceByEntityId(entityId: string): Promise<ProvenanceRecord | null> {
    const p = await this.prisma.provenanceRecord.findFirst({
      where: { target_entity_id: entityId },
      orderBy: { persisted_at: 'desc' }
    });
    if (!p) return null;
    return {
      id: p.id,
      targetEntityType: p.target_entity_type as any,
      targetEntityId: p.target_entity_id,
      sourceSystemId: p.source_system_id,
      sourceRecordId: p.source_record_id,
      rawRecordId: p.id,
      mappingConfigId: 'DEFAULT_MAP',
      mappingVersion: p.mapping_version,
      adapterVersion: p.adapter_version,
      ingestedAt: p.persisted_at.toISOString(),
      transformedAt: p.persisted_at.toISOString(),
      persistedAt: p.persisted_at.toISOString(),
      validationScore: 100,
      validationDecision: 'ACCEPTED',
      activityDescription: 'Record ingestion and transformation'
    } as any;
  }

  async getAllProvenance(): Promise<ProvenanceRecord[]> {
    const ps = await this.prisma.provenanceRecord.findMany({ orderBy: { persisted_at: 'desc' }});
    return ps.map(p => ({
      id: p.id,
      targetEntityType: p.target_entity_type as any,
      targetEntityId: p.target_entity_id,
      sourceSystemId: p.source_system_id,
      sourceRecordId: p.source_record_id,
      rawRecordId: p.id,
      mappingConfigId: 'DEFAULT_MAP',
      mappingVersion: p.mapping_version,
      adapterVersion: p.adapter_version,
      ingestedAt: p.persisted_at.toISOString(),
      transformedAt: p.persisted_at.toISOString(),
      persistedAt: p.persisted_at.toISOString(),
      validationScore: 100,
      validationDecision: 'ACCEPTED',
      activityDescription: 'Record ingestion and transformation'
    } as any));
  }

  async recordAudit(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: entry.id || uuidv4(),
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        action: entry.action,
        actor_id: entry.actor,
        details: entry.detail,
        created_at: new Date(entry.timestamp)
      }
    });
  }

  async getAuditLog(limit: number = 50): Promise<AuditEntry[]> {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: limit
    });
    return logs.map(l => ({
      id: l.id,
      timestamp: l.created_at.toISOString(),
      action: (l.action as any) || 'PERSISTED',
      entityType: l.entity_type,
      entityId: l.entity_id,
      actor: l.actor_id || 'UNKNOWN',
      detail: l.details || ''
    }));
  }
}
