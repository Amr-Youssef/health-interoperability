import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DynamicHospitalRegistry } from '../../src/ingestion/dynamic/dynamic-adapter.js';

describe('DynamicHospitalRegistry persistence', () => {
  it('stores registry data in a real SQLite database file', async () => {
    const dbPath = path.resolve(process.cwd(), '.data', 'test-registry.sqlite');
    fs.rmSync(dbPath, { force: true });

    const registry = new DynamicHospitalRegistry(dbPath);
    registry.clearAll();

    registry.registerHospital({
      hospitalId: 'hospital-real-db',
      hospitalName: 'Real DB Hospital',
      hospitalNameAr: 'مستشفى قاعدة البيانات الحقيقية',
      facilityType: 'hospital',
      region: 'Riyadh',
      adapterVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      sourceSchema: {
        systemId: 'hospital-real-db',
        systemName: 'Real DB Hospital',
        sourceType: 'relational',
        entityTypes: ['patient_reg'],
        fieldCatalog: {}
      },
      defaultMappingConfigs: []
    });

    expect(fs.existsSync(dbPath)).toBe(true);

    registry.close();

    const reloaded = new DynamicHospitalRegistry(dbPath);
    expect(reloaded.getHospital('hospital-real-db')).toMatchObject({ hospitalId: 'hospital-real-db' });

    reloaded.clearAll();
    reloaded.close();

    fs.rmSync(dbPath, { force: true });
    fs.rmSync(`${dbPath}-wal`, { force: true });
    fs.rmSync(`${dbPath}-shm`, { force: true });
  });
});
