import { ProvenanceRecord, AuditEntry } from '../core/domain/provenance.js';

export class ProvenanceService {
  private provenanceRecords: Map<string, ProvenanceRecord> = new Map(); // key = targetEntityId
  private auditLog: AuditEntry[] = [];

  async recordProvenance(record: ProvenanceRecord): Promise<void> {
    this.provenanceRecords.set(record.targetEntityId, { ...record });
    
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
    const p = this.provenanceRecords.get(entityId);
    return p ? { ...p } : null;
  }

  async getAllProvenance(): Promise<ProvenanceRecord[]> {
    return Array.from(this.provenanceRecords.values()).map(p => ({ ...p }));
  }

  async recordAudit(entry: AuditEntry): Promise<void> {
    this.auditLog.unshift({ ...entry });
    if (this.auditLog.length > 500) {
      this.auditLog.pop();
    }
  }

  async getAuditLog(limit: number = 50): Promise<AuditEntry[]> {
    return this.auditLog.slice(0, limit);
  }
}
