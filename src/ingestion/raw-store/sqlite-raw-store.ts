import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { RawRecord } from '../../core/domain/raw-record.js';
import { ProcessingStatus } from '../../core/domain/types.js';
import { RawStore, RawStoreStats } from './raw-store.interface.js';

export class SqliteRawStore implements RawStore {
  private db: DatabaseSync;

  constructor(filePath?: string) {
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
        lastReprocessedAt TEXT
      );
    `);
  }

  private toRecord(row: any): RawRecord {
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
      processingStatus: row.processingStatus as ProcessingStatus,
      errorMessage: row.errorMessage || undefined,
      reprocessCount: row.reprocessCount || 0,
      lastReprocessedAt: row.lastReprocessedAt || undefined
    };
  }

  async save(record: RawRecord): Promise<void> {
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
    `).run(
      record.id,
      record.sourceSystemId,
      record.sourceEntityType,
      record.sourceRecordId,
      JSON.stringify(record.payload),
      record.payloadFormat,
      record.adapterVersion,
      record.ingestedAt,
      record.batchId,
      record.checksum,
      record.processingStatus,
      record.errorMessage || null,
      record.reprocessCount || 0,
      record.lastReprocessedAt || null
    );
  }

  async saveBatch(records: RawRecord[]): Promise<void> {
    this.db.exec('BEGIN');
    try {
      for (const record of records) {
        await this.save(record);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async getById(id: string): Promise<RawRecord | null> {
    const row = this.db.prepare('SELECT * FROM raw_records WHERE id = ?').get(id) as any;
    return row ? this.toRecord(row) : null;
  }

  async findBySource(sourceSystemId: string, entityType?: string): Promise<RawRecord[]> {
    const sql = entityType
      ? 'SELECT * FROM raw_records WHERE sourceSystemId = ? AND LOWER(sourceEntityType) = LOWER(?) ORDER BY ingestedAt DESC'
      : 'SELECT * FROM raw_records WHERE sourceSystemId = ? ORDER BY ingestedAt DESC';
    const rows = entityType
      ? this.db.prepare(sql).all(sourceSystemId, entityType)
      : this.db.prepare(sql).all(sourceSystemId);
    return (rows as any[]).map((row) => this.toRecord(row));
  }

  async findPending(sourceSystemId?: string): Promise<RawRecord[]> {
    const base = "SELECT * FROM raw_records WHERE processingStatus IN ('PENDING', 'REPROCESSED')";
    const rows = sourceSystemId
      ? this.db.prepare(`${base} AND sourceSystemId = ? ORDER BY ingestedAt DESC`).all(sourceSystemId)
      : this.db.prepare(`${base} ORDER BY ingestedAt DESC`).all();
    return (rows as any[]).map((row) => this.toRecord(row));
  }

  async updateStatus(id: string, status: ProcessingStatus, errorMessage?: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE raw_records
      SET processingStatus = ?, errorMessage = ?
      WHERE id = ?
    `);
    stmt.run(status, errorMessage || null, id);
  }

  async markReprocessed(id: string): Promise<void> {
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

  async getStats(): Promise<RawStoreStats> {
    const total = this.db.prepare('SELECT COUNT(*) as total FROM raw_records').get() as { total: number };

    const bySystemRows = this.db.prepare('SELECT sourceSystemId, COUNT(*) as count FROM raw_records GROUP BY sourceSystemId').all() as any[];
    const byStatusRows = this.db.prepare('SELECT processingStatus as status, COUNT(*) as count FROM raw_records GROUP BY processingStatus').all() as any[];
    const byEntityTypeRows = this.db.prepare('SELECT sourceSystemId, sourceEntityType, COUNT(*) as count FROM raw_records GROUP BY sourceSystemId, sourceEntityType').all() as any[];

    const bySystem: Record<string, number> = {};
    for (const row of bySystemRows) {
      bySystem[row.sourceSystemId] = row.count;
    }

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRows) {
      byStatus[row.status] = row.count;
    }

    const byEntityType: Record<string, number> = {};
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

  async getAll(): Promise<RawRecord[]> {
    const rows = this.db.prepare('SELECT * FROM raw_records ORDER BY ingestedAt DESC').all() as any[];
    return rows.map((row) => this.toRecord(row));
  }

  async clearAll(): Promise<void> {
    this.db.exec('DELETE FROM raw_records');
  }

  close(): void {
    this.db.close();
  }
}
