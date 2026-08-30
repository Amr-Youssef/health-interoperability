import fs from 'fs';
import path from 'path';
export class InMemoryRawStore {
    persistPath;
    records = new Map();
    constructor(persistPath) {
        if (persistPath === null) {
            this.persistPath = '';
        }
        else {
            this.persistPath = persistPath || path.resolve(process.cwd(), '.data', 'raw-store.json');
            this.loadFromDisk();
        }
    }
    saveToDisk() {
        if (!this.persistPath)
            return;
        try {
            const dir = path.dirname(this.persistPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            const recordsArray = Array.from(this.records.values());
            fs.writeFileSync(this.persistPath, JSON.stringify(recordsArray, null, 2), 'utf-8');
        }
        catch (err) {
            console.warn('⚠️ RawStore disk persistence warning:', err.message);
        }
    }
    loadFromDisk() {
        if (!this.persistPath)
            return;
        try {
            if (!fs.existsSync(this.persistPath))
                return;
            const raw = fs.readFileSync(this.persistPath, 'utf-8');
            const records = JSON.parse(raw);
            for (const r of records) {
                this.records.set(r.id, r);
            }
            console.log(`📂 Loaded ${this.records.size} raw record(s) from disk store.`);
        }
        catch (err) {
            console.warn('⚠️ RawStore disk load warning:', err.message);
        }
    }
    async save(record) {
        this.records.set(record.id, { ...record });
        this.saveToDisk();
    }
    async saveBatch(records) {
        for (const record of records) {
            this.records.set(record.id, { ...record });
        }
        this.saveToDisk();
    }
    async getById(id) {
        const record = this.records.get(id);
        return record ? { ...record } : null;
    }
    async findBySource(sourceSystemId, entityType) {
        const result = [];
        for (const record of this.records.values()) {
            if (record.sourceSystemId === sourceSystemId) {
                if (!entityType || record.sourceEntityType.toLowerCase() === entityType.toLowerCase()) {
                    result.push({ ...record });
                }
            }
        }
        return result;
    }
    async findPending(sourceSystemId) {
        const result = [];
        for (const record of this.records.values()) {
            if (record.processingStatus === 'PENDING' || record.processingStatus === 'REPROCESSED') {
                if (!sourceSystemId || record.sourceSystemId === sourceSystemId) {
                    result.push({ ...record });
                }
            }
        }
        return result;
    }
    async updateStatus(id, status, errorMessage) {
        const record = this.records.get(id);
        if (record) {
            record.processingStatus = status;
            if (errorMessage)
                record.errorMessage = errorMessage;
            this.records.set(id, record);
            this.saveToDisk();
        }
    }
    async markReprocessed(id) {
        const record = this.records.get(id);
        if (record) {
            record.processingStatus = 'PENDING';
            record.reprocessCount = (record.reprocessCount || 0) + 1;
            record.lastReprocessedAt = new Date().toISOString();
            delete record.errorMessage;
            this.records.set(id, record);
            this.saveToDisk();
        }
    }
    async getStats() {
        const bySystem = {};
        const byStatus = {};
        const byEntityType = {};
        for (const r of this.records.values()) {
            bySystem[r.sourceSystemId] = (bySystem[r.sourceSystemId] || 0) + 1;
            byStatus[r.processingStatus] = (byStatus[r.processingStatus] || 0) + 1;
            const entityKey = `${r.sourceSystemId}:${r.sourceEntityType}`;
            byEntityType[entityKey] = (byEntityType[entityKey] || 0) + 1;
        }
        return {
            totalRecords: this.records.size,
            bySystem,
            byStatus,
            byEntityType
        };
    }
    async getAll() {
        return Array.from(this.records.values()).map(r => ({ ...r }));
    }
    async clearAll() {
        this.records.clear();
        this.saveToDisk();
    }
}
//# sourceMappingURL=memory-raw-store.js.map