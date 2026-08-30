import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SqliteRawStore } from '../../src/ingestion/raw-store/sqlite-raw-store.js';
import { RawRecord } from '../../src/core/domain/raw-record.js';

describe('SqliteRawStore', () => {
  it('persists records and aggregates stats across store instances', async () => {
    const dbPath = path.resolve(process.cwd(), '.data', 'test-real-store.sqlite');
    fs.rmSync(dbPath, { force: true });

    const store1 = new SqliteRawStore(dbPath);
    const record: RawRecord = {
      id: 'rec-123',
      sourceSystemId: 'hospital-a',
      sourceEntityType: 'patient_reg',
      sourceRecordId: 'A-1001',
      payload: { mrn: 'A-1001', name: 'Ahmed' },
      payloadFormat: 'json',
      adapterVersion: '1.0.0',
      ingestedAt: new Date().toISOString(),
      batchId: 'batch-1',
      checksum: 'abc123',
      processingStatus: 'PERSISTED'
    };

    await store1.save(record);

    const store2 = new SqliteRawStore(dbPath);
    const found = await store2.getById(record.id);
    const stats = await store2.getStats();

    expect(found).toMatchObject({ id: record.id, sourceSystemId: 'hospital-a' });
    expect(stats.totalRecords).toBe(1);
    expect(stats.bySystem['hospital-a']).toBe(1);

    store1.close();
    store2.close();
    fs.rmSync(dbPath, { force: true });
  });
});
