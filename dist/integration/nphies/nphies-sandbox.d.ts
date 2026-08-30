import { CanonicalClaim, CanonicalCoverage, CanonicalClaimResponse, CanonicalCoverageEligibility } from '../../core/domain/financial.js';
export declare class NphiesSandboxSimulator {
    readonly gatewayUrl = "https://sandbox.nphies.sa/fhir/ksa/nphies-fs";
    readonly version = "1.0.0-sandbox";
    /**
     * Simulates real-time NPHIES Insurance Eligibility Inquiry
     */
    checkEligibility(coverage: CanonicalCoverage): Promise<CanonicalCoverageEligibility>;
    /**
     * Simulates NPHIES eClaim Real-time Adjudication Engine according to CHI rules
     */
    adjudicateClaim(claim: CanonicalClaim, coverage?: CanonicalCoverage): Promise<CanonicalClaimResponse>;
}
