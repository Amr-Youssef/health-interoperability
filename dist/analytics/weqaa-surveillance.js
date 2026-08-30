import { v4 as uuidv4 } from 'uuid';
export const SAUDI_REPORTABLE_DISEASES = [
    {
        code: 'MERS-COV',
        name: 'Middle East Respiratory Syndrome Coronavirus (MERS-CoV)',
        nameAr: 'متلازمة الشرق الأوسط التنفسية (فيروس كورونا)',
        snomedCode: '700000000',
        icd10amPrefix: 'B34.2',
        urgency: 'IMMEDIATE_6H',
        authority: 'Weqaa'
    },
    {
        code: 'DENGUE',
        name: 'Dengue Fever',
        nameAr: 'حمى الضنك',
        snomedCode: '38362002',
        icd10amPrefix: 'A90',
        urgency: 'URGENT_24H',
        authority: 'Weqaa'
    },
    {
        code: 'MEASLES',
        name: 'Measles',
        nameAr: 'الحصبة',
        snomedCode: '14189004',
        icd10amPrefix: 'B05',
        urgency: 'IMMEDIATE_6H',
        authority: 'Weqaa'
    },
    {
        code: 'TB',
        name: 'Tuberculosis (Active)',
        nameAr: 'الدرن (السل النشط)',
        snomedCode: '56717001',
        icd10amPrefix: 'A15',
        urgency: 'ROUTINE_WEEKLY',
        authority: 'Weqaa'
    },
    {
        code: 'HEPATITIS_B',
        name: 'Acute Viral Hepatitis B',
        nameAr: 'التهاب الكبد الفيروسي الحاد (ب)',
        snomedCode: '235866006',
        icd10amPrefix: 'B16',
        urgency: 'ROUTINE_WEEKLY',
        authority: 'Weqaa'
    }
];
export class WeqaaSurveillanceEngine {
    canonicalStore;
    fhirSerializer;
    dispatchedCases = new Map();
    constructor(canonicalStore, fhirSerializer) {
        this.canonicalStore = canonicalStore;
        this.fhirSerializer = fhirSerializer;
    }
    /**
     * Scans canonical conditions and lab observations to identify reportable disease events
     */
    async detectReportableCases() {
        const conditions = await this.canonicalStore.getAllConditions();
        const patients = await this.canonicalStore.getAllPatients();
        const cases = [];
        for (const cond of conditions) {
            const p = patients.find(pat => pat.internalId === cond.patientId);
            const nid = p?.identifiers?.find(i => i.type === 'NID')?.value || '1088445566';
            const patName = p ? `${p.givenNameAr || p.givenName} ${p.familyNameAr || p.familyName}` : 'مريض مجهول';
            for (const def of SAUDI_REPORTABLE_DISEASES) {
                const matchesSnomed = cond.code?.snomedCode === def.snomedCode;
                const matchesIcd = cond.code?.icd10amCode?.startsWith(def.icd10amPrefix);
                const matchesSourceText = cond.code?.sourceCode?.includes(def.nameAr) || cond.code?.sourceDisplay?.includes(def.nameAr);
                if (matchesSnomed || matchesIcd || matchesSourceText) {
                    const existing = this.dispatchedCases.get(cond.internalId);
                    cases.push(existing || {
                        caseId: `WEQAA-CASE-${cond.internalId.substring(0, 8)}`,
                        patientId: cond.patientId,
                        patientName: patName,
                        nationalId: nid,
                        diseaseName: def.name,
                        diseaseNameAr: def.nameAr,
                        snomedCode: cond.code?.snomedCode || def.snomedCode,
                        icdCode: cond.code?.icd10amCode || def.icd10amPrefix,
                        detectedFrom: 'Condition',
                        sourceRecordId: cond.internalId,
                        sourceFacilityId: cond.provenance?.sourceSystemId || 'hospital-a',
                        urgency: def.urgency,
                        notificationStatus: 'PENDING_DISPATCH',
                        detectedAt: cond.recordedDate
                    });
                }
            }
        }
        return cases;
    }
    /**
     * Generates standard HL7 FHIR R4 Public Health Notification Message Bundle for Weqaa
     */
    async generateWeqaaNotificationBundle(caseId) {
        const cases = await this.detectReportableCases();
        const targetCase = cases.find(c => c.caseId === caseId) || cases[0];
        if (!targetCase)
            throw new Error(`Reportable case [${caseId}] not found.`);
        const patient = await this.canonicalStore.getPatient(targetCase.patientId);
        const messageId = `msg-weqaa-${uuidv4()}`;
        const timestamp = new Date().toISOString();
        const fhirPatient = patient ? this.fhirSerializer.serializePatient(patient) : {};
        return {
            resourceType: 'Bundle',
            id: `bundle-weqaa-${caseId}`,
            type: 'message',
            timestamp,
            entry: [
                {
                    fullUrl: `urn:uuid:${messageId}`,
                    resource: {
                        resourceType: 'MessageHeader',
                        id: messageId,
                        eventCoding: {
                            system: 'urn:sa:weqaa:surveillance:events',
                            code: 'COMMUNICABLE_DISEASE_NOTIFICATION',
                            display: targetCase.diseaseName
                        },
                        source: {
                            name: 'Saudi National Health Interoperability Normalization Engine',
                            software: 'Saudi-HIE-Platform',
                            version: '0.2.4',
                            endpoint: 'https://hie.moh.gov.sa/fhir'
                        },
                        destination: [
                            {
                                name: 'Weqaa National Surveillance Command Center (Saudi CDC)',
                                endpoint: 'https://surveillance.weqaa.gov.sa/fhir/notification'
                            }
                        ],
                        focus: [
                            { reference: `Patient/${targetCase.patientId}` }
                        ]
                    }
                },
                {
                    fullUrl: `/fhir/Patient/${targetCase.patientId}`,
                    resource: fhirPatient
                },
                {
                    fullUrl: `/fhir/Condition/${targetCase.sourceRecordId}`,
                    resource: {
                        resourceType: 'Condition',
                        id: targetCase.sourceRecordId,
                        clinicalStatus: {
                            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }]
                        },
                        code: {
                            coding: [
                                { system: 'http://snomed.info/sct', code: targetCase.snomedCode, display: targetCase.diseaseName },
                                { system: 'urn:sa:icd-10-am', code: targetCase.icdCode }
                            ],
                            text: targetCase.diseaseNameAr
                        },
                        subject: { reference: `Patient/${targetCase.patientId}` },
                        recordedDate: targetCase.detectedAt
                    }
                }
            ]
        };
    }
    /**
     * Simulates dispatching the notification to Weqaa Public Health Authority and returns confirmation tracking ID
     */
    async dispatchCaseNotification(caseId) {
        const cases = await this.detectReportableCases();
        const targetCase = cases.find(c => c.caseId === caseId);
        if (!targetCase)
            throw new Error(`Reportable case [${caseId}] not found.`);
        const trackingNumber = `WEQAA-SA-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        const updatedCase = {
            ...targetCase,
            notificationStatus: 'DISPATCHED_TO_WEQAA',
            dispatchedAt: new Date().toISOString(),
            weqaaTrackingNumber: trackingNumber
        };
        this.dispatchedCases.set(targetCase.sourceRecordId, updatedCase);
        return updatedCase;
    }
}
//# sourceMappingURL=weqaa-surveillance.js.map