import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { HOSPITAL_B_DATASET } from '../../synthetic/hospital-b-data.js';
export class HospitalBAdapter {
    sourceSystemId = 'hospital-b';
    sourceSystemName = 'مستشفى النور الحديث (Hospital B - Relational HIS)';
    adapterVersion = '1.4.0';
    calculateChecksum(payload) {
        return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }
    async extractAll(batchId = uuidv4()) {
        const records = [];
        const timestamp = new Date().toISOString();
        // 1. pt_master
        for (const patient of HOSPITAL_B_DATASET.patients) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'pt_master',
                sourceRecordId: patient.mrn,
                payload: patient,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(patient),
                processingStatus: 'PENDING'
            });
        }
        // 2. encounters
        for (const enc of HOSPITAL_B_DATASET.encounters) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'encounters',
                sourceRecordId: enc.enc_id,
                payload: enc,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(enc),
                processingStatus: 'PENDING'
            });
        }
        // 3. dx
        for (const dx of HOSPITAL_B_DATASET.diagnoses) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'dx',
                sourceRecordId: dx.dx_id,
                payload: dx,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(dx),
                processingStatus: 'PENDING'
            });
        }
        // 4. lab_orders
        for (const lab of HOSPITAL_B_DATASET.labOrders) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'lab_orders',
                sourceRecordId: lab.order_id,
                payload: lab,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(lab),
                processingStatus: 'PENDING'
            });
        }
        // 5. policies
        for (const pol of HOSPITAL_B_DATASET.policies) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'policies',
                sourceRecordId: pol.policy_id,
                payload: pol,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(pol),
                processingStatus: 'PENDING'
            });
        }
        // 6. claims
        for (const clm of HOSPITAL_B_DATASET.claims) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'claims',
                sourceRecordId: clm.claim_id,
                payload: clm,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(clm),
                processingStatus: 'PENDING'
            });
        }
        // 7. prescriptions (rx_orders)
        for (const rx of HOSPITAL_B_DATASET.prescriptions) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'rx_orders',
                sourceRecordId: rx.rx_id,
                payload: rx,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(rx),
                processingStatus: 'PENDING'
            });
        }
        // 8. vaccinations
        for (const vax of HOSPITAL_B_DATASET.vaccinations) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'vaccinations',
                sourceRecordId: vax.vax_id,
                payload: vax,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(vax),
                processingStatus: 'PENDING'
            });
        }
        // 9. allergies
        if (HOSPITAL_B_DATASET.allergies) {
            for (const alg of HOSPITAL_B_DATASET.allergies) {
                records.push({
                    id: uuidv4(),
                    sourceSystemId: this.sourceSystemId,
                    sourceEntityType: 'allergies',
                    sourceRecordId: alg.allergy_id,
                    payload: alg,
                    payloadFormat: 'relational-row',
                    adapterVersion: this.adapterVersion,
                    ingestedAt: timestamp,
                    batchId,
                    checksum: this.calculateChecksum(alg),
                    processingStatus: 'PENDING'
                });
            }
        }
        return records;
    }
    async extractEntity(entityType, batchId = uuidv4()) {
        const all = await this.extractAll(batchId);
        return all.filter(r => r.sourceEntityType === entityType);
    }
    async healthCheck() {
        const total = HOSPITAL_B_DATASET.patients.length +
            HOSPITAL_B_DATASET.encounters.length +
            HOSPITAL_B_DATASET.diagnoses.length +
            HOSPITAL_B_DATASET.labOrders.length +
            HOSPITAL_B_DATASET.policies.length +
            HOSPITAL_B_DATASET.claims.length +
            HOSPITAL_B_DATASET.prescriptions.length +
            HOSPITAL_B_DATASET.vaccinations.length +
            (HOSPITAL_B_DATASET.allergies?.length || 0);
        return {
            systemId: this.sourceSystemId,
            status: 'ONLINE',
            lastHeartbeat: new Date().toISOString(),
            latencyMs: 8,
            extractedRecordCount: total,
            version: this.adapterVersion
        };
    }
    describeSchema() {
        return {
            systemId: this.sourceSystemId,
            systemName: this.sourceSystemName,
            sourceType: 'relational',
            entityTypes: ['pt_master', 'encounters', 'dx', 'lab_orders', 'policies', 'claims', 'rx_orders', 'vaccinations'],
            fieldCatalog: {
                rx_orders: [
                    { field: 'rx_id', type: 'VARCHAR(20)', sampleValue: 'RX-B-8801' },
                    { field: 'drug_code', type: 'VARCHAR(50)', sampleValue: 'RX-MET-500' }
                ],
                vaccinations: [
                    { field: 'vax_id', type: 'VARCHAR(20)', sampleValue: 'VAX-B-991' },
                    { field: 'vax_code', type: 'VARCHAR(50)', sampleValue: 'VAC-FLU-QUAD' }
                ]
            }
        };
    }
}
//# sourceMappingURL=hospital-b-adapter.js.map