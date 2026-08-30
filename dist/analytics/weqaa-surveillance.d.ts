import { CanonicalStore } from '../persistence/canonical-store.js';
import { FhirR4Serializer } from '../fhir/fhir-serializer.js';
export type SurveillanceUrgency = 'IMMEDIATE_6H' | 'URGENT_24H' | 'ROUTINE_WEEKLY';
export interface ReportableDiseaseDefinition {
    code: string;
    name: string;
    nameAr: string;
    snomedCode: string;
    icd10amPrefix: string;
    urgency: SurveillanceUrgency;
    authority: string;
}
export interface WeqaaReportableCase {
    caseId: string;
    patientId: string;
    patientName: string;
    nationalId: string;
    diseaseName: string;
    diseaseNameAr: string;
    snomedCode: string;
    icdCode: string;
    detectedFrom: 'Condition' | 'Observation' | 'Encounter';
    sourceRecordId: string;
    sourceFacilityId: string;
    urgency: SurveillanceUrgency;
    notificationStatus: 'PENDING_DISPATCH' | 'DISPATCHED_TO_WEQAA' | 'ACKNOWLEDGED';
    detectedAt: string;
    dispatchedAt?: string;
    weqaaTrackingNumber?: string;
}
export declare const SAUDI_REPORTABLE_DISEASES: ReportableDiseaseDefinition[];
export declare class WeqaaSurveillanceEngine {
    private canonicalStore;
    private fhirSerializer;
    private dispatchedCases;
    constructor(canonicalStore: CanonicalStore, fhirSerializer: FhirR4Serializer);
    /**
     * Scans canonical conditions and lab observations to identify reportable disease events
     */
    detectReportableCases(): Promise<WeqaaReportableCase[]>;
    /**
     * Generates standard HL7 FHIR R4 Public Health Notification Message Bundle for Weqaa
     */
    generateWeqaaNotificationBundle(caseId: string): Promise<Record<string, any>>;
    /**
     * Simulates dispatching the notification to Weqaa Public Health Authority and returns confirmation tracking ID
     */
    dispatchCaseNotification(caseId: string): Promise<WeqaaReportableCase>;
}
