import { RawRecord } from '../../core/domain/raw-record.js';
import { MappingConfiguration } from '../../core/domain/mapping-config.js';
import { TransformEngine } from '../transformation/transform-engine.js';
import { TerminologyService } from '../../terminology/terminology-service.js';
export interface MappedEntityResult {
    rawRecordId: string;
    sourceSystemId: string;
    sourceRecordId: string;
    targetCanonicalEntity: string;
    mappingConfigId: string;
    mappingVersion: string;
    terminologyMapVersion?: string;
    data: Record<string, any>;
    unmappedFields: string[];
}
export declare class MappingEngine {
    private configurations;
    private transformEngine;
    private terminologyService;
    constructor(terminologyService: TerminologyService, transformEngine?: TransformEngine);
    private loadDefaultConfigurations;
    registerConfiguration(config: MappingConfiguration): void;
    getConfiguration(sourceSystemId: string, sourceEntityType: string): MappingConfiguration | null;
    getAllConfigurations(): MappingConfiguration[];
    private setNestedProperty;
    /**
     * Executes the 3-stage Mapping Pipeline on a raw record
     */
    mapRecord(rawRecord: RawRecord): Promise<MappedEntityResult>;
    /**
     * Normalizes standard FHIR R4 resources from Hospital C into Canonical domain representation
     */
    private mapFhirResource;
}
