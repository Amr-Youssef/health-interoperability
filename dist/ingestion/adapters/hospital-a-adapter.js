import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { HOSPITAL_A_DATASET } from '../../synthetic/hospital-a-data.js';
export class HospitalAAdapter {
    sourceSystemId = 'hospital-a';
    sourceSystemName = 'مستشفى الأمل التخصصي (Hospital A - Legacy HIS)';
    adapterVersion = '1.2.0';
    calculateChecksum(payload) {
        return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }
    async extractAll(batchId = uuidv4()) {
        const records = [];
        const timestamp = new Date().toISOString();
        // 1. Patients
        for (const patient of HOSPITAL_A_DATASET.patients) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'patient',
                sourceRecordId: patient.رقم_المريض,
                payload: patient,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(patient),
                processingStatus: 'PENDING'
            });
        }
        // 2. Visits
        for (const visit of HOSPITAL_A_DATASET.visits) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'visit',
                sourceRecordId: visit.رقم_الزيارة,
                payload: visit,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(visit),
                processingStatus: 'PENDING'
            });
        }
        // 3. Diagnoses
        for (const dx of HOSPITAL_A_DATASET.diagnoses) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'diagnosis',
                sourceRecordId: dx.رقم_التشخيص,
                payload: dx,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(dx),
                processingStatus: 'PENDING'
            });
        }
        // 4. Lab Results
        for (const lab of HOSPITAL_A_DATASET.labResults) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'lab_result',
                sourceRecordId: lab.رقم_الفحص,
                payload: lab,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(lab),
                processingStatus: 'PENDING'
            });
        }
        // 5. Insurance Policies
        for (const ins of HOSPITAL_A_DATASET.insurance) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'insurance_policy',
                sourceRecordId: ins.رقم_البوليصة,
                payload: ins,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(ins),
                processingStatus: 'PENDING'
            });
        }
        // 6. Bills & Claims
        for (const bill of HOSPITAL_A_DATASET.bills) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'bill_claim',
                sourceRecordId: bill.رقم_الفاتورة,
                payload: bill,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(bill),
                processingStatus: 'PENDING'
            });
        }
        // 7. Prescriptions (Medications)
        for (const rx of HOSPITAL_A_DATASET.prescriptions) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'prescription',
                sourceRecordId: rx.رقم_الوصفة,
                payload: rx,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(rx),
                processingStatus: 'PENDING'
            });
        }
        // 8. Vaccinations
        for (const vax of HOSPITAL_A_DATASET.vaccinations) {
            records.push({
                id: uuidv4(),
                sourceSystemId: this.sourceSystemId,
                sourceEntityType: 'vaccination',
                sourceRecordId: vax.رقم_التطعيم,
                payload: vax,
                payloadFormat: 'relational-row',
                adapterVersion: this.adapterVersion,
                ingestedAt: timestamp,
                batchId,
                checksum: this.calculateChecksum(vax),
                processingStatus: 'PENDING'
            });
        }
        // 9. Allergies
        if (HOSPITAL_A_DATASET.allergies) {
            for (const alg of HOSPITAL_A_DATASET.allergies) {
                records.push({
                    id: uuidv4(),
                    sourceSystemId: this.sourceSystemId,
                    sourceEntityType: 'allergy',
                    sourceRecordId: alg.رقم_الحساسية,
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
        const total = HOSPITAL_A_DATASET.patients.length +
            HOSPITAL_A_DATASET.visits.length +
            HOSPITAL_A_DATASET.diagnoses.length +
            HOSPITAL_A_DATASET.labResults.length +
            HOSPITAL_A_DATASET.insurance.length +
            HOSPITAL_A_DATASET.bills.length +
            HOSPITAL_A_DATASET.prescriptions.length +
            HOSPITAL_A_DATASET.vaccinations.length +
            (HOSPITAL_A_DATASET.allergies?.length || 0);
        return {
            systemId: this.sourceSystemId,
            status: 'ONLINE',
            lastHeartbeat: new Date().toISOString(),
            latencyMs: 12,
            extractedRecordCount: total,
            version: this.adapterVersion
        };
    }
    describeSchema() {
        return {
            systemId: this.sourceSystemId,
            systemName: this.sourceSystemName,
            sourceType: 'relational',
            entityTypes: ['patient', 'visit', 'diagnosis', 'lab_result', 'insurance_policy', 'bill_claim', 'prescription', 'vaccination'],
            fieldCatalog: {
                patient: [
                    { field: 'رقم_المريض', type: 'VARCHAR(10)', arabicLabel: 'رقم الملف الطبي', sampleValue: 'A-10234' },
                    { field: 'الاسم_الاول', type: 'NVARCHAR(100)', arabicLabel: 'الاسم الأول', sampleValue: 'أحمد' }
                ],
                prescription: [
                    { field: 'رقم_الوصفة', type: 'VARCHAR(20)', arabicLabel: 'رقم الوصفة', sampleValue: 'RX-HA-101' },
                    { field: 'كود_الدواء', type: 'VARCHAR(50)', arabicLabel: 'رمز الدواء', sampleValue: 'دواء_ميتفورمين_500' }
                ],
                vaccination: [
                    { field: 'رقم_التطعيم', type: 'VARCHAR(20)', arabicLabel: 'رقم التطعيم', sampleValue: 'VAX-HA-501' },
                    { field: 'كود_اللقاح', type: 'VARCHAR(50)', arabicLabel: 'رمز اللقاح', sampleValue: 'تطعيم_الإنفلونزا_الموسمية' }
                ]
            }
        };
    }
}
//# sourceMappingURL=hospital-a-adapter.js.map