import { ProcessingStatus } from './types.js';

export interface RawRecord {
  id: string; // UUID
  sourceSystemId: string;
  sourceEntityType: string;
  sourceRecordId: string;
  payload: Record<string, any>;
  payloadFormat: 'relational-row' | 'fhir-resource' | 'json';
  adapterVersion: string;
  ingestedAt: string;
  batchId: string;
  checksum: string; // SHA-256
  processingStatus: ProcessingStatus;
  errorMessage?: string;
  reprocessCount?: number;
  lastReprocessedAt?: string;
  // Per-record pipeline trace (persisted stage outcomes)
  validationScore?: number;
  validationDecision?: string;
  validationIssuesCount?: number;
  mappingVersion?: string;
  mappingConfigId?: string;
  terminologySummary?: { systems: string[]; conceptCount: number; mapVersion?: string } | null;
  mpiStrategy?: string;
  mpiConfidence?: number;
  mpiIdentityId?: string;
}
