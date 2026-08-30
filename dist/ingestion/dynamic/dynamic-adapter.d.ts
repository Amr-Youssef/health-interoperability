import { SourceAdapter, SourceSchemaDescriptor, AdapterStatus } from '../adapters/adapter.interface.js';
import { RawRecord } from '../../core/domain/raw-record.js';
import { MappingConfiguration } from '../../core/domain/mapping-config.js';
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
export declare class GenericConfigurableAdapter implements SourceAdapter {
    readonly sourceSystemId: string;
    readonly sourceSystemName: string;
    readonly adapterVersion: string;
    readonly definition: DynamicHospitalDefinition;
    private queuedRecords;
    constructor(definition: DynamicHospitalDefinition);
    extractAll(batchId?: string): Promise<RawRecord[]>;
    extractEntity(entityType: string, batchId?: string): Promise<RawRecord[]>;
    queueRawRecord(entityType: string, sourceRecordId: string, payload: any, payloadFormat?: 'relational-row' | 'fhir-resource' | 'custom-json'): RawRecord;
    healthCheck(): Promise<AdapterStatus>;
    describeSchema(): SourceSchemaDescriptor;
}
export declare class DynamicHospitalRegistry {
    private prisma;
    constructor(prisma?: PrismaClient);
    static isDemoHospital(definition?: Partial<DynamicHospitalDefinition>): boolean;
    registerHospital(definition: DynamicHospitalDefinition): Promise<GenericConfigurableAdapter>;
    getHospital(hospitalId: string): Promise<DynamicHospitalDefinition | undefined>;
    getAllHospitals(): Promise<DynamicHospitalDefinition[]>;
    getAdapter(hospitalId: string): Promise<GenericConfigurableAdapter | undefined>;
    getAllAdapters(): Promise<GenericConfigurableAdapter[]>;
    clearAll(): Promise<void>;
}
