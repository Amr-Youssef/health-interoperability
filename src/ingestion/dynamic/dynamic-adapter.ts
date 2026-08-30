import { v4 as uuidv4 } from 'uuid';
import { SourceAdapter, SourceSchemaDescriptor, AdapterStatus } from '../adapters/adapter.interface.js';
import { RawRecord } from '../../core/domain/raw-record.js';
import { MappingConfiguration } from '../../core/domain/mapping-config.js';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

export interface DynamicHospitalDefinition {
  hospitalId: string;
  hospitalName: string;
  hospitalNameAr: string;
  facilityType: 'hospital' | 'day_surgery' | 'clinic' | 'laboratory' | 'pharmacy';
  region: 'Riyadh' | 'Makkah' | 'Eastern' | 'Madinah' | 'Asir';
  adapterVersion: string;
  sourceSchema: SourceSchemaDescriptor;
  defaultMappingConfigs: MappingConfiguration[];
  createdAt: string;
}

export class GenericConfigurableAdapter implements SourceAdapter {
  readonly sourceSystemId: string;
  readonly sourceSystemName: string;
  readonly adapterVersion: string;
  readonly definition: DynamicHospitalDefinition;
  private queuedRecords: RawRecord[] = [];

  constructor(definition: DynamicHospitalDefinition) {
    this.definition = definition;
    this.sourceSystemId = definition.hospitalId;
    this.sourceSystemName = definition.hospitalNameAr || definition.hospitalName;
    this.adapterVersion = definition.adapterVersion || '1.0.0';
  }

  async extractAll(batchId?: string): Promise<RawRecord[]> {
    const records = [...this.queuedRecords];
    this.queuedRecords = [];
    return records;
  }

  async extractEntity(entityType: string, batchId?: string): Promise<RawRecord[]> {
    const records = this.queuedRecords.filter(r => r.sourceEntityType === entityType);
    this.queuedRecords = this.queuedRecords.filter(r => r.sourceEntityType !== entityType);
    return records;
  }

  queueRawRecord(entityType: string, sourceRecordId: string, payload: any, payloadFormat: 'relational-row' | 'fhir-resource' | 'custom-json' = 'custom-json'): RawRecord {
    const rawId = uuidv4();
    const payloadStr = JSON.stringify(payload);
    const checksum = crypto.createHash('sha256').update(payloadStr).digest('hex');

    const record: RawRecord = {
      id: rawId,
      sourceSystemId: this.sourceSystemId,
      sourceEntityType: entityType,
      sourceRecordId,
      payload,
      payloadFormat: payloadFormat as any,
      adapterVersion: this.adapterVersion,
      ingestedAt: new Date().toISOString(),
      checksum,
      processingStatus: 'PENDING',
      batchId: uuidv4()
    };

    this.queuedRecords.push(record);
    return record;
  }

  async healthCheck(): Promise<AdapterStatus> {
    return {
      systemId: this.sourceSystemId,
      status: 'ONLINE',
      lastHeartbeat: new Date().toISOString(),
      latencyMs: 6,
      extractedRecordCount: this.queuedRecords.length,
      version: this.adapterVersion
    };
  }

  describeSchema(): SourceSchemaDescriptor {
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
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  static isDemoHospital(definition?: Partial<DynamicHospitalDefinition>): boolean {
    if (!definition) return true;
    const haystack = `${definition.hospitalId || ''} ${definition.hospitalName || ''} ${definition.hospitalNameAr || ''}`.toLowerCase();
    return /(demo|test|mock|fake|sample|example)/.test(haystack);
  }

  async registerHospital(definition: DynamicHospitalDefinition): Promise<GenericConfigurableAdapter> {
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

  async getHospital(hospitalId: string): Promise<DynamicHospitalDefinition | undefined> {
    const dbHospital = await this.prisma.dynamicHospital.findUnique({ where: { hospitalId } });
    if (!dbHospital) return undefined;

    return {
      hospitalId: dbHospital.hospitalId,
      hospitalName: dbHospital.hospitalName,
      hospitalNameAr: dbHospital.hospitalNameAr,
      facilityType: dbHospital.facilityType as any,
      region: dbHospital.region as any,
      adapterVersion: dbHospital.adapterVersion,
      sourceSchema: JSON.parse(dbHospital.sourceSchema),
      defaultMappingConfigs: JSON.parse(dbHospital.defaultMappingConfigs),
      createdAt: dbHospital.createdAt
    };
  }

  async getAllHospitals(): Promise<DynamicHospitalDefinition[]> {
    const dbHospitals = await this.prisma.dynamicHospital.findMany();
    return dbHospitals.map(dbHospital => ({
      hospitalId: dbHospital.hospitalId,
      hospitalName: dbHospital.hospitalName,
      hospitalNameAr: dbHospital.hospitalNameAr,
      facilityType: dbHospital.facilityType as any,
      region: dbHospital.region as any,
      adapterVersion: dbHospital.adapterVersion,
      sourceSchema: JSON.parse(dbHospital.sourceSchema),
      defaultMappingConfigs: JSON.parse(dbHospital.defaultMappingConfigs),
      createdAt: dbHospital.createdAt
    }));
  }

  async getAdapter(hospitalId: string): Promise<GenericConfigurableAdapter | undefined> {
    const hospital = await this.getHospital(hospitalId);
    if (!hospital) return undefined;
    return new GenericConfigurableAdapter(hospital);
  }

  async getAllAdapters(): Promise<GenericConfigurableAdapter[]> {
    const hospitals = await this.getAllHospitals();
    return hospitals.map(h => new GenericConfigurableAdapter(h));
  }

  async clearAll(): Promise<void> {
    await this.prisma.dynamicHospital.deleteMany();
  }
}
