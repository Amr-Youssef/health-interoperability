import { IdentifierType } from './types.js';

export interface PatientIdentifier {
  value: string;
  type: IdentifierType;
  system: string; // e.g. "urn:sa:nid", "urn:sa:iqama", "urn:sa:passport", "urn:hospital-a:mrn"
  sourceSystemId: string;
  isActive: boolean;
  firstSeenAt: string;
  verified?: boolean;
}
