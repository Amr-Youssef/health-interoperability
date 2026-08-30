export class ProvenanceService {
    provenanceRecords = new Map(); // key = targetEntityId
    auditLog = [];
    async recordProvenance(record) {
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
    async getProvenanceByEntityId(entityId) {
        const p = this.provenanceRecords.get(entityId);
        return p ? { ...p } : null;
    }
    async getAllProvenance() {
        return Array.from(this.provenanceRecords.values()).map(p => ({ ...p }));
    }
    async recordAudit(entry) {
        this.auditLog.unshift({ ...entry });
        if (this.auditLog.length > 500) {
            this.auditLog.pop();
        }
    }
    async getAuditLog(limit = 50) {
        return this.auditLog.slice(0, limit);
    }
}
//# sourceMappingURL=provenance-service.js.map