import { v4 as uuidv4 } from 'uuid';
import { CanonicalClaim, CanonicalCoverage, CanonicalClaimResponse, CanonicalCoverageEligibility } from '../../core/domain/financial.js';

export class NphiesSandboxSimulator {
  readonly gatewayUrl = 'https://sandbox.nphies.sa/fhir/ksa/nphies-fs';
  readonly version = '1.0.0-sandbox';

  /**
   * Simulates real-time NPHIES Insurance Eligibility Inquiry
   */
  async checkEligibility(coverage: CanonicalCoverage): Promise<CanonicalCoverageEligibility> {
    const isExpired = new Date(coverage.period.end) < new Date();
    const status = isExpired ? 'not_eligible' : 'eligible';

    const copayPct = coverage.networkClass === 'VIP' ? 0 : 20;

    return {
      internalId: uuidv4(),
      patientId: coverage.patientId,
      coverageId: coverage.internalId,
      serviceProviderId: 'HOSP-PROVIDER-01',
      status: status as any,
      verifiedAt: new Date().toISOString(),
      offlineReference: undefined,
      benefits: [
        {
          category: 'consultation',
          categoryAr: 'كشف واستشارة طبية',
          covered: true,
          copayPercentage: copayPct,
          maxLimitSAR: coverage.copayMaxCapSAR || 100,
          requiresPriorAuth: false
        },
        {
          category: 'laboratory',
          categoryAr: 'التحاليل والفحوصات المخبرية',
          covered: true,
          copayPercentage: copayPct,
          maxLimitSAR: 5000,
          requiresPriorAuth: false
        },
        {
          category: 'pharmacy',
          categoryAr: 'الأدوية والوصفات الطبية',
          covered: true,
          copayPercentage: copayPct,
          maxLimitSAR: 3000,
          requiresPriorAuth: false
        },
        {
          category: 'inpatient',
          categoryAr: 'التنويم والعمليات الجراحية',
          covered: true,
          copayPercentage: 0,
          maxLimitSAR: coverage.annualMaxLimitSAR || 500000,
          requiresPriorAuth: true
        }
      ]
    };
  }

  /**
   * Simulates NPHIES eClaim Real-time Adjudication Engine according to CHI rules
   */
  async adjudicateClaim(claim: CanonicalClaim, coverage?: CanonicalCoverage): Promise<CanonicalClaimResponse> {
    const transactionId = `NPHIES-TX-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const copayPct = coverage ? (coverage.networkClass === 'VIP' ? 0 : (coverage.copayPercentage / 100 || 0.2)) : 0.2;
    const maxCopayCap = coverage?.copayMaxCapSAR ?? 100;

    let runningPatientCopay = 0;
    let totalApproved = 0;
    let totalPayerPayable = 0;

    const itemAdjudications = claim.items.map((item, index) => {
      const gross = item.totalGrossSAR || (item.unitPriceSAR * item.quantity);
      
      // Calculate item copay with overall cap
      let rawCopay = gross * copayPct;
      if (runningPatientCopay + rawCopay > maxCopayCap && maxCopayCap > 0) {
        rawCopay = Math.max(0, maxCopayCap - runningPatientCopay);
      }
      runningPatientCopay += rawCopay;

      const payerShare = gross - rawCopay;
      totalApproved += gross;
      totalPayerPayable += payerShare;

      return {
        sequence: item.sequence || index + 1,
        adjudicatedAmountSAR: gross,
        patientCopaySAR: rawCopay,
        payerPayableSAR: payerShare,
        status: 'approved' as const
      };
    });

    return {
      internalId: uuidv4(),
      claimId: claim.internalId,
      patientId: claim.patientId,
      coverageId: claim.coverageId,
      outcome: 'complete',
      disposition: 'Approved',
      totalApprovedSAR: totalApproved,
      totalPatientCopaySAR: runningPatientCopay,
      totalPayerPayableSAR: totalPayerPayable,
      itemAdjudications,
      adjudicatedAt: new Date().toISOString(),
      nphiesTransactionId: transactionId
    };
  }
}
