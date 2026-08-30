import { ProvenanceInfo } from './types.js';
import { ClinicalCode } from './clinical-code.js';

export interface CanonicalCoverage {
  internalId: string;
  patientId: string; // FK to CanonicalPatient
  
  // Payer (Insurance Company)
  payerId: string; // e.g. "INS-CHI-101"
  payerName: string;
  payerNameAr: string;
  
  policyNumber: string;
  memberId: string;
  networkClass: 'VIP' | 'Class A' | 'Class B' | 'Class C';
  
  // Council of Health Insurance (CHI) Unified Policy Rules
  copayPercentage: number; // e.g. 20 (meaning 20%)
  copayMaxCapSAR: number;  // e.g. 100 SAR maximum copay per outpatient visit
  annualMaxLimitSAR: number; // e.g. 500,000 SAR
  
  period: {
    start: string;
    end: string;
  };
  
  status: 'active' | 'cancelled' | 'draft' | 'expired';
  provenance: ProvenanceInfo;
  createdAt: string;
}

export interface CanonicalCoverageEligibility {
  internalId: string;
  patientId: string;
  coverageId: string;
  serviceProviderId: string;
  
  status: 'eligible' | 'not_eligible' | 'requires_preauth';
  verifiedAt: string;
  offlineReference?: string;
  
  benefits: {
    category: 'consultation' | 'laboratory' | 'pharmacy' | 'radiology' | 'inpatient';
    categoryAr: string;
    covered: boolean;
    copayPercentage: number;
    maxLimitSAR: number;
    requiresPriorAuth: boolean;
  }[];
}

export interface ClaimItem {
  sequence: number;
  serviceCode: ClinicalCode; // Saudi Billing System (SBS) or ACHI
  serviceName: string;
  serviceNameAr?: string;
  quantity: number;
  unitPriceSAR: number;
  totalGrossSAR: number;
  patientCopaySAR: number;
  netClaimedSAR: number;
  patientInvoiceNo?: string;
}

export interface CanonicalClaim {
  internalId: string;
  patientId: string;
  encounterId: string;
  coverageId: string;
  serviceProviderId: string;
  
  claimType: 'institutional' | 'professional' | 'pharmacy';
  subType: 'outpatient' | 'inpatient' | 'emergency';
  
  use: 'claim' | 'preauthorization' | 'predetermination';
  status: 'draft' | 'submitted' | 'adjudicated' | 'settled' | 'rejected';
  
  // Diagnoses associated with claim
  diagnoses: {
    sequence: number;
    code: ClinicalCode; // ICD-10-AM + SBS
    type: 'principal' | 'admitting' | 'secondary';
  }[];
  
  items: ClaimItem[];
  
  // Financial Totals
  totalGrossSAR: number;
  totalPatientCopaySAR: number;
  totalInsurerClaimedSAR: number;
  
  // Saudi-specific NPHIES claim tracking
  isNewborn?: boolean;
  isTransfer?: boolean;
  batchId?: string;
  batchNumber?: string;
  
  submissionDate: string;
  provenance: ProvenanceInfo;
  createdAt: string;
}

export interface CanonicalClaimResponse {
  internalId: string;
  claimId: string;
  patientId: string;
  coverageId: string;
  
  outcome: 'complete' | 'error' | 'partial' | 'pended';
  disposition: 'Approved' | 'Rejected' | 'Partially Approved';
  
  totalApprovedSAR: number;
  totalPatientCopaySAR: number;
  totalPayerPayableSAR: number;
  
  itemAdjudications: {
    sequence: number;
    adjudicatedAmountSAR: number;
    patientCopaySAR: number;
    payerPayableSAR: number;
    status: 'approved' | 'rejected' | 'modified';
    rejectionReason?: string;
  }[];
  
  adjudicatedAt: string;
  nphiesTransactionId: string;
}
