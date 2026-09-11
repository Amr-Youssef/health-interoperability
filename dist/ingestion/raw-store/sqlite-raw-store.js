/**
 * @deprecated TEST ONLY — Do not use in production. PrismaRawStore (PostgreSQL) is the single source of truth.
 * Retained only for fast unit tests that run with :memory: without Docker.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
export class SqliteRawStore {
    db;
    constructor(filePath) {
        const resolvedPath = filePath || path.resolve(process.cwd(), '.data', 'raw-store.db');
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new DatabaseSync(resolvedPath);
        this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS raw_records (
        id TEXT PRIMARY KEY,
        sourceSystemId TEXT NOT NULL,
        sourceEntityType TEXT NOT NULL,
        sourceRecordId TEXT NOT NULL,
        payload TEXT NOT NULL,
        payloadFormat TEXT NOT NULL,
        adapterVersion TEXT NOT NULL,
        ingestedAt TEXT NOT NULL,
        batchId TEXT NOT NULL,
        checksum TEXT NOT NULL,
        processingStatus TEXT NOT NULL,
        errorMessage TEXT,
        reprocessCount INTEGER DEFAULT 0,
        lastReprocessedAt TEXT,
        validationScore INTEGER,
        validationDecision TEXT,
        validationIssuesCount INTEGER DEFAULT 0,
        mappingVersion TEXT,
        mappingConfigId TEXT,
        terminologySummary TEXT,
        mpiStrategy TEXT,
        mpiConfidence REAL,
        mpiIdentityId TEXT,
        UNIQUE(sourceSystemId, sourceEntityType, sourceRecordId)
      );
    `);
    }
    toRecord(row) {
        return {
            id: row.id,
            sourceSystemId: row.sourceSystemId,
            sourceEntityType: row.sourceEntityType,
            sourceRecordId: row.sourceRecordId,
            payload: JSON.parse(row.payload || '{}'),
            payloadFormat: row.payloadFormat,
            adapterVersion: row.adapterVersion,
            ingestedAt: row.ingestedAt,
            batchId: row.batchId,
            checksum: row.checksum,
            processingStatus: row.processingStatus,
            errorMessage: row.errorMessage || undefined,
            reprocessCount: row.reprocessCount || 0,
            lastReprocessedAt: row.lastReprocessedAt || undefined,
            validationScore: row.validationScore ?? undefined,
            validationDecision: row.validationDecision || undefined,
            validationIssuesCount: row.validationIssuesCount || 0,
            mappingVersion: row.mappingVersion || undefined,
            mappingConfigId: row.mappingConfigId || undefined,
            terminologySummary: row.terminologySummary ? JSON.parse(row.terminologySummary) : null,
            mpiStrategy: row.mpiStrategy || undefined,
            mpiConfidence: row.mpiConfidence ?? undefined,
            mpiIdentityId: row.mpiIdentityId || undefined
        };
    }
    async save(record) {
        this.db.prepare(`
      INSERT INTO raw_records (
        id, sourceSystemId, sourceEntityType, sourceRecordId, payload, payloadFormat,
        adapterVersion, ingestedAt, batchId, checksum, processingStatus, errorMessage,
        reprocessCount, lastReprocessedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        sourceSystemId = excluded.sourceSystemId,
        sourceEntityType = excluded.sourceEntityType,
        sourceRecordId = excluded.sourceRecordId,
        payload = excluded.payload,
        payloadFormat = excluded.payloadFormat,
        adapterVersion = excluded.adapterVersion,
        ingestedAt = excluded.ingestedAt,
        batchId = excluded.batchId,
        checksum = excluded.checksum,
        processingStatus = excluded.processingStatus,
        errorMessage = excluded.errorMessage,
        reprocessCount = excluded.reprocessCount,
        lastReprocessedAt = excluded.lastReprocessedAt
    `).run(record.id, record.sourceSystemId, record.sourceEntityType, record.sourceRecordId, JSON.stringify(record.payload), record.payloadFormat, record.adapterVersion, record.ingestedAt, record.batchId, record.checksum, record.processingStatus, record.errorMessage || null, record.reprocessCount || 0, record.lastReprocessedAt || null);
    }
    async saveBatch(records) {
        this.db.exec('BEGIN');
        try {
            for (const record of records) {
                await this.save(record);
            }
            this.db.exec('COMMIT');
        }
        catch (err) {
            this.db.exec('ROLLBACK');
            throw err;
        }
    }
    async getById(id) {
        const row = this.db.prepare('SELECT * FROM raw_records WHERE id = ?').get(id);
        return row ? this.toRecord(row) : null;
    }
    async findBySource(sourceSystemId, entityType) {
        const sql = entityType
            ? 'SELECT * FROM raw_records WHERE sourceSystemId = ? AND LOWER(sourceEntityType) = LOWER(?) ORDER BY ingestedAt DESC'
            : 'SELECT * FROM raw_records WHERE sourceSystemId = ? ORDER BY ingestedAt DESC';
        const rows = entityType
            ? this.db.prepare(sql).all(sourceSystemId, entityType)
            : this.db.prepare(sql).all(sourceSystemId);
        return rows.map((row) => this.toRecord(row));
    }
    async findPending(sourceSystemId) {
        const base = "SELECT * FROM raw_records WHERE processingStatus IN ('PENDING', 'REPROCESSED')";
        const rows = sourceSystemId
            ? this.db.prepare(`${base} AND sourceSystemId = ? ORDER BY ingestedAt DESC`).all(sourceSystemId)
            : this.db.prepare(`${base} ORDER BY ingestedAt DESC`).all();
        return rows.map((row) => this.toRecord(row));
    }
    async updateStatus(id, status, errorMessage) {
        const stmt = this.db.prepare(`
      UPDATE raw_records
      SET processingStatus = ?, errorMessage = ?
      WHERE id = ?
    `);
        stmt.run(status, errorMessage || null, id);
    }
    async recordPipelineTrace(id, trace) {
        const sets = [];
        const vals = [];
        if (trace.validationScore !== undefined) {
            sets.push('validationScore = ?');
            vals.push(trace.validationScore);
        }
        if (trace.validationDecision !== undefined) {
            sets.push('validationDecision = ?');
            vals.push(trace.validationDecision);
        }
        if (trace.validationIssuesCount !== undefined) {
            sets.push('validationIssuesCount = ?');
            vals.push(trace.validationIssuesCount);
        }
        if (trace.mappingVersion !== undefined) {
            sets.push('mappingVersion = ?');
            vals.push(trace.mappingVersion);
        }
        if (trace.mappingConfigId !== undefined) {
            sets.push('mappingConfigId = ?');
            vals.push(trace.mappingConfigId);
        }
        if (trace.terminologySummary !== undefined) {
            sets.push('terminologySummary = ?');
            vals.push(trace.terminologySummary ? JSON.stringify(trace.terminologySummary) : null);
        }
        if (trace.mpiStrategy !== undefined) {
            sets.push('mpiStrategy = ?');
            vals.push(trace.mpiStrategy);
        }
        if (trace.mpiConfidence !== undefined) {
            sets.push('mpiConfidence = ?');
            vals.push(trace.mpiConfidence);
        }
        if (trace.mpiIdentityId !== undefined) {
            sets.push('mpiIdentityId = ?');
            vals.push(trace.mpiIdentityId);
        }
        if (sets.length === 0)
            return;
        vals.push(id);
        this.db.prepare(`UPDATE raw_records SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    }
    async markReprocessed(id) {
        const stmt = this.db.prepare(`
      UPDATE raw_records
      SET processingStatus = 'PENDING',
          reprocessCount = COALESCE(reprocessCount, 0) + 1,
          lastReprocessedAt = ?,
          errorMessage = NULL
      WHERE id = ?
    `);
        stmt.run(new Date().toISOString(), id);
    }
    async getStats() {
        const total = this.db.prepare('SELECT COUNT(*) as total FROM raw_records').get();
        const bySystemRows = this.db.prepare('SELECT sourceSystemId, COUNT(*) as count FROM raw_records GROUP BY sourceSystemId').all();
        const byStatusRows = this.db.prepare('SELECT processingStatus as status, COUNT(*) as count FROM raw_records GROUP BY processingStatus').all();
        const byEntityTypeRows = this.db.prepare('SELECT sourceSystemId, sourceEntityType, COUNT(*) as count FROM raw_records GROUP BY sourceSystemId, sourceEntityType').all();
        const bySystem = {};
        for (const row of bySystemRows) {
            bySystem[row.sourceSystemId] = row.count;
        }
        const byStatus = {};
        for (const row of byStatusRows) {
            byStatus[row.status] = row.count;
        }
        const byEntityType = {};
        for (const row of byEntityTypeRows) {
            const key = `${row.sourceSystemId}:${row.sourceEntityType}`;
            byEntityType[key] = row.count;
        }
        return {
            totalRecords: total.total,
            bySystem,
            byStatus,
            byEntityType
        };
    }
    async getAll() {
        const rows = this.db.prepare('SELECT * FROM raw_records ORDER BY ingestedAt DESC').all();
        return rows.map((row) => this.toRecord(row));
    }
    async clearAll() {
        this.db.exec('DELETE FROM raw_records');
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=sqlite-raw-store.js.map