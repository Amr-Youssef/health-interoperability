import { CanonicalStore } from '../persistence/canonical-store.js';
export interface PopulationHealthMetrics {
    totalMasterPatients: number;
    totalEncounters: number;
    interoperabilityIndex: {
        multiFacilityPatientPercentage: number;
        crossHospitalLinkagesCount: number;
    };
    chronicDiseasePrevalence: {
        conditionName: string;
        conditionNameAr: string;
        snomedCode: string;
        icd10amCode: string;
        patientCount: number;
        prevalencePercentage: number;
    }[];
    immunizationCoverage: {
        vaccineName: string;
        vaccineNameAr: string;
        cvxCode: string;
        administeredCount: number;
        coveragePercentage: number;
    }[];
    financialInteroperability: {
        totalClaimsGrossSAR: number;
        totalInsurerPayableSAR: number;
        totalPatientCopaySAR: number;
        adjudicationApprovalRate: number;
        averageSettlementDurationSeconds: number;
    };
}
export declare class PopulationHealthService {
    private canonicalStore;
    constructor(canonicalStore: CanonicalStore);
    calculateMetrics(): Promise<PopulationHealthMetrics>;
}
