import { CanonicalStore } from '../persistence/canonical-store.js';
export interface CdsCard {
    uuid: string;
    summary: string;
    summaryAr: string;
    detail: string;
    detailAr: string;
    indicator: 'info' | 'warning' | 'critical';
    source: {
        label: string;
        labelAr: string;
        url?: string;
    };
    suggestions?: {
        label: string;
        labelAr: string;
        actionType: 'adjust_dose' | 'discontinue' | 'order_lab' | 'schedule_vaccine' | 'alternative_drug';
    }[];
}
export interface CdsHookResponse {
    hook: string;
    patientId: string;
    timestamp: string;
    cards: CdsCard[];
}
export interface ProspectivePrescriptionDraft {
    patientId: string;
    drugCode: string;
    drugName: string;
    dosage: string;
    route: string;
    frequency: string;
}
export declare class CdsHooksEngine {
    private canonicalStore;
    constructor(canonicalStore: CanonicalStore);
    /**
     * Evaluate CDS Hooks for prospective draft prescription before signing
     */
    evaluateDraftPrescription(draft: ProspectivePrescriptionDraft): Promise<CdsHookResponse>;
    /**
     * Evaluate CDS Hooks for patient view (Background health alerts)
     */
    evaluateMedicationSafety(patientId: string): Promise<CdsHookResponse>;
}
