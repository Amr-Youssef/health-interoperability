import { RawRecord } from '../../core/domain/raw-record.js';
import { MappingConfiguration } from '../../core/domain/mapping-config.js';
import { TransformEngine } from '../transformation/transform-engine.js';
import { TerminologyService } from '../../terminology/terminology-service.js';
import { MappedEntityResult } from './mapping-engine.js';
export declare class FhirResourceMapper {
    private terminologyService;
    private transformEngine;
    constructor(terminologyService: TerminologyService, transformEngine: TransformEngine);
    map(rawRecord: RawRecord, config: MappingConfiguration): Promise<MappedEntityResult>;
}
