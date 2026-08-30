import { ClinicalCode } from './clinical-code.js';
import { ProvenanceInfo } from './types.js';

export type DiagnosticReportStatus =
  | 'registered'
  | 'partial'
  | 'preliminary'
  | 'final'
  | 'amended'
  | 'corrected'
  | 'appended'
  | 'cancelled';

export type DiagnosticReportCategory = 'LAB' | 'RAD' | 'CAR' | 'PATH' | 'GEN';

export interface CanonicalDiagnosticReport {
  internalId: string;
  patientId: string;
  encounterId?: string;
  status: DiagnosticReportStatus;
  category: DiagnosticReportCategory;
  code: ClinicalCode;
  issued: string;
  performerOrganizationId?: string;
  resultObservationIds: string[];
  conclusion?: string;
  conclusionAr?: string;
  provenance: ProvenanceInfo;
}
