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
}
