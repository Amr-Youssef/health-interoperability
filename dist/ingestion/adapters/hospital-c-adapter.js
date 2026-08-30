import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { HOSPITAL_C_DATASET } from '../../synthetic/hospital-c-data.js';
export class HospitalCAdapter {
    sourceSystemId = 'hospital-c';
    sourceSystemName = 'مركز الملك فهد التخصصي (Hospital C - FHIR Native R4)';
    adapterVersion = '2.0.0';
    calculateChecksum(payload) {
        return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }
    async extractAll(batchId = uuidv4()) {
        const records = [];
        const timestamp = new Date().toISOString();
        for (const resource of HOSPITAL_C_DATASET.resources) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: resource.resourceType,
                sourceRecordId: resource.id,
                payload: resource,
                payloadFormat: 'fhir-resource',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(resource),
                processingStatus: 'PENDING'
            });
        }
        return records;
    }
    async extractEntity(entityType, batchId = uuidv4()) {
        const all = await this.extractAll(batchId);
        return all.filter(r => r.sourceEntityType.toLowerCase() === entityType.toLowerCase());
    }
    async healthCheck() {
        return {
            systemId: this.sourceSystemId,
            status: 'ONLINE',
            lastHeartbeat: new Date().toISOString(),
            latencyMs: 5,
            extractedRecordCount: HOSPITAL_C_DATASET.resources.length,
            version: this.adapterVersion
        };
    }
    describeSchema() {
        return {
            systemId: this.sourceSystemId,
            systemName: this.sourceSystemName,
            sourceType: 'fhir',
            entityTypes: ['Patient', 'Encounter', 'Condition', 'Observation'],
            fieldCatalog: {
                Patient: [
                    { field: 'id', type: 'id', sampleValue: 'hc-pat-5567' },
                    { field: 'identifier', type: 'Identifier[]', sampleValue: [{ system: 'urn:sa:nid', value: '1088445566' }] },
                    { field: 'name', type: 'HumanName[]', sampleValue: [{ family: 'الراشدي', given: ['أحمد'] }] },
                    { field: 'gender', type: 'code', sampleValue: 'male' },
                    { field: 'birthDate', type: 'date', sampleValue: '1984-04-01' }
                ],
                Encounter: [
                    { field: 'id', type: 'id', sampleValue: 'hc-enc-1102' },
                    { field: 'status', type: 'code', sampleValue: 'finished' },
                    { field: 'class', type: 'Coding', sampleValue: { code: 'AMB' } },
                    { field: 'subject', type: 'Reference', sampleValue: { reference: 'Patient/hc-pat-5567' } }
                ],
                Condition: [
                    { field: 'id', type: 'id', sampleValue: 'hc-cond-883' },
                    { field: 'code', type: 'CodeableConcept', sampleValue: { coding: [{ system: 'http://snomed.info/sct', code: '44054006' }] } },
                    { field: 'subject', type: 'Reference', sampleValue: { reference: 'Patient/hc-pat-5567' } }
                ],
                Observation: [
                    { field: 'id', type: 'id', sampleValue: 'hc-obs-991' },
                    { field: 'code', type: 'CodeableConcept', sampleValue: { coding: [{ system: 'http://loinc.org', code: '4548-4' }] } },
                    { field: 'valueQuantity', type: 'Quantity', sampleValue: { value: 7.2, unit: '%' } },
                    { field: 'subject', type: 'Reference', sampleValue: { reference: 'Patient/hc-pat-5567' } }
                ]
            }
        };
    }
}
//# sourceMappingURL=hospital-c-adapter.js.map