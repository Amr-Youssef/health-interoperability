import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
export class GenericConfigurableAdapter {
    sourceSystemId;
    sourceSystemName;
    adapterVersion;
    definition;
    queuedRecords = [];
    constructor(definition) {
        this.definition = definition;
        this.sourceSystemId = definition.hospitalId;
        this.sourceSystemName = definition.hospitalNameAr || definition.hospitalName;
        this.adapterVersion = definition.adapterVersion || '1.0.0';
    }
    async extractAll(batchId) {
        const records = [...this.queuedRecords];
        this.queuedRecords = [];
        return records;
    }
    async extractEntity(entityType, batchId) {
        const records = this.queuedRecords.filter(r => r.sourceEntityType === entityType);
        this.queuedRecords = this.queuedRecords.filter(r => r.sourceEntityType !== entityType);
        return records;
    }
    queueRawRecord(entityType, sourceRecordId, payload, payloadFormat = 'custom-json') {
        const rawId = uuidv4();
        const payloadStr = JSON.stringify(payload);
        const checksum = crypto.createHash('sha256').update(payloadStr).digest('hex');
        const record = {
            id: rawId,
            sourceSystemId: this.sourceSystemId,
            sourceEntityType: entityType,
            sourceRecordId,
            payload,
            payloadFormat: payloadFormat,
            adapterVersion: this.adapterVersion,
            ingestedAt: new Date().toISOString(),
            checksum,
            processingStatus: 'PENDING',
            batchId: uuidv4()
        };
        this.queuedRecords.push(record);
        return record;
    }
    async healthCheck() {
        return {
            systemId: this.sourceSystemId,
            status: 'ONLINE',
            lastHeartbeat: new Date().toISOString(),
            latencyMs: 6,
            extractedRecordCount: this.queuedRecords.length,
            version: this.adapterVersion
        };
    }
    describeSchema() {
        const schema = this.definition.sourceSchema;
        // Ensure it has the required properties
        return {
            systemId: schema.systemId || this.sourceSystemId,
            systemName: schema.systemName || this.sourceSystemName,
            sourceType: schema.sourceType || 'relational',
            entityTypes: schema.entityTypes || [],
            fieldCatalog: schema.fieldCatalog || {}
        };
    }
}
export class DynamicHospitalRegistry {
    hospitals = new Map();
    dynamicAdapters = new Map();
    persistPath;
    db;
    static isDemoHospital(definition) {
        if (!definition)
            return true;
        const haystack = `${definition.hospitalId || ''} ${definition.hospitalName || ''} ${definition.hospitalNameAr || ''}`.toLowerCase();
        return /(demo|test|mock|fake|sample|example)/.test(haystack);
    }
    constructor(dbPath) {
        const fallbackPath = path.resolve(process.cwd(), '.data', 'hospitals-registry.db');
        this.persistPath = dbPath || fallbackPath;
        const dir = path.dirname(this.persistPath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        this.db = new DatabaseSync(this.persistPath);
        this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS dynamic_hospitals (
        hospitalId TEXT PRIMARY KEY,
        hospitalName TEXT NOT NULL,
        hospitalNameAr TEXT NOT NULL,
        facilityType TEXT NOT NULL,
        region TEXT NOT NULL,
        adapterVersion TEXT NOT NULL,
        sourceSchema TEXT NOT NULL,
        defaultMappingConfigs TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
        this.loadFromDisk();
    }
    registerHospital(definition) {
        this.hospitals.set(definition.hospitalId, definition);
        const adapter = new GenericConfigurableAdapter(definition);
        this.dynamicAdapters.set(definition.hospitalId, adapter);
        this.saveToDisk();
        return adapter;
    }
    getHospital(hospitalId) {
        return this.hospitals.get(hospitalId);
    }
    getAllHospitals() {
        return Array.from(this.hospitals.values());
    }
    getAdapter(hospitalId) {
        return this.dynamicAdapters.get(hospitalId);
    }
    getAllAdapters() {
        return Array.from(this.dynamicAdapters.values());
    }
    saveToDisk() {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO dynamic_hospitals (
          hospitalId, hospitalName, hospitalNameAr, facilityType, region,
          adapterVersion, sourceSchema, defaultMappingConfigs, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(hospitalId) DO UPDATE SET
          hospitalName = excluded.hospitalName,
          hospitalNameAr = excluded.hospitalNameAr,
          facilityType = excluded.facilityType,
          region = excluded.region,
          adapterVersion = excluded.adapterVersion,
          sourceSchema = excluded.sourceSchema,
          defaultMappingConfigs = excluded.defaultMappingConfigs,
          createdAt = excluded.createdAt
      `);
            for (const hospital of this.hospitals.values()) {
                stmt.run(hospital.hospitalId, hospital.hospitalName, hospital.hospitalNameAr, hospital.facilityType, hospital.region, hospital.adapterVersion, JSON.stringify(hospital.sourceSchema), JSON.stringify(hospital.defaultMappingConfigs), hospital.createdAt);
            }
        }
        catch (e) {
            console.warn('⚠️ Could not persist hospital registry:', e.message);
        }
    }
    loadFromDisk() {
        try {
            const rows = this.db.prepare('SELECT * FROM dynamic_hospitals ORDER BY hospitalId ASC').all();
            let loaded = 0;
            for (const row of rows) {
                const def = {
                    hospitalId: row.hospitalId,
                    hospitalName: row.hospitalName,
                    hospitalNameAr: row.hospitalNameAr,
                    facilityType: row.facilityType,
                    region: row.region,
                    adapterVersion: row.adapterVersion,
                    sourceSchema: JSON.parse(row.sourceSchema || '{}'),
                    defaultMappingConfigs: JSON.parse(row.defaultMappingConfigs || '[]'),
                    createdAt: row.createdAt
                };
                if (DynamicHospitalRegistry.isDemoHospital(def)) {
                    this.db.exec(`DELETE FROM dynamic_hospitals WHERE hospitalId = '${row.hospitalId.replace(/'/g, "''")}'`);
                    continue;
                }
                this.hospitals.set(def.hospitalId, def);
                const adapter = new GenericConfigurableAdapter(def);
                this.dynamicAdapters.set(def.hospitalId, adapter);
                loaded++;
            }
            console.log(`📂 Loaded ${loaded} persisted hospital(s) from disk.`);
        }
        catch (e) {
            console.warn('⚠️ Could not load hospital registry:', e.message);
        }
    }
    clearAll() {
        this.hospitals.clear();
        this.dynamicAdapters.clear();
        this.db.exec('DELETE FROM dynamic_hospitals');
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=dynamic-adapter.js.map