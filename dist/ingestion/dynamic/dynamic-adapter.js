import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { prisma as defaultPrisma } from '../../lib/prisma.js';
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
    prisma;
    constructor(prisma) {
        this.prisma = prisma || defaultPrisma;
    }
    static isDemoHospital(definition) {
        if (!definition)
            return true;
        const haystack = `${definition.hospitalId || ''} ${definition.hospitalName || ''} ${definition.hospitalNameAr || ''}`.toLowerCase();
        return /(demo|test|mock|fake|sample|example)/.test(haystack);
    }
    async registerHospital(definition) {
        await this.prisma.dynamicHospital.upsert({
            where: { hospitalId: definition.hospitalId },
            update: {
                hospitalName: definition.hospitalName,
                hospitalNameAr: definition.hospitalNameAr,
                facilityType: definition.facilityType,
                region: definition.region,
                adapterVersion: definition.adapterVersion,
                sourceSchema: JSON.stringify(definition.sourceSchema),
                defaultMappingConfigs: JSON.stringify(definition.defaultMappingConfigs),
                createdAt: new Date().toISOString()
            },
            create: {
                hospitalId: definition.hospitalId,
                hospitalName: definition.hospitalName,
                hospitalNameAr: definition.hospitalNameAr,
                facilityType: definition.facilityType,
                region: definition.region,
                adapterVersion: definition.adapterVersion,
                sourceSchema: JSON.stringify(definition.sourceSchema),
                defaultMappingConfigs: JSON.stringify(definition.defaultMappingConfigs),
                createdAt: new Date().toISOString()
            }
        });
        return new GenericConfigurableAdapter(definition);
    }
    async getHospital(hospitalId) {
        const dbHospital = await this.prisma.dynamicHospital.findUnique({ where: { hospitalId } });
        if (!dbHospital)
            return undefined;
        return {
            hospitalId: dbHospital.hospitalId,
            hospitalName: dbHospital.hospitalName,
            hospitalNameAr: dbHospital.hospitalNameAr,
            facilityType: dbHospital.facilityType,
            region: dbHospital.region,
            adapterVersion: dbHospital.adapterVersion,
            sourceSchema: JSON.parse(dbHospital.sourceSchema),
            defaultMappingConfigs: JSON.parse(dbHospital.defaultMappingConfigs),
            createdAt: dbHospital.createdAt
        };
    }
    async getAllHospitals() {
        const dbHospitals = await this.prisma.dynamicHospital.findMany();
        return dbHospitals.map(dbHospital => ({
            hospitalId: dbHospital.hospitalId,
            hospitalName: dbHospital.hospitalName,
            hospitalNameAr: dbHospital.hospitalNameAr,
            facilityType: dbHospital.facilityType,
            region: dbHospital.region,
            adapterVersion: dbHospital.adapterVersion,
            sourceSchema: JSON.parse(dbHospital.sourceSchema),
            defaultMappingConfigs: JSON.parse(dbHospital.defaultMappingConfigs),
            createdAt: dbHospital.createdAt
        }));
    }
    async getAdapter(hospitalId) {
        const hospital = await this.getHospital(hospitalId);
        if (!hospital)
            return undefined;
        return new GenericConfigurableAdapter(hospital);
    }
    async getAllAdapters() {
        const hospitals = await this.getAllHospitals();
        return hospitals.map(h => new GenericConfigurableAdapter(h));
    }
    async clearAll() {
        await this.prisma.dynamicHospital.deleteMany();
    }
}
//# sourceMappingURL=dynamic-adapter.js.map