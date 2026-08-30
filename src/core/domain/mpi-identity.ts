import { PatientIdentifier } from './patient-identifier.js';

export type MatchStrategy = 
  | 'NID_EXACT' 
  | 'IQAMA_EXACT' 
  | 'PASSPORT_EXACT' 
  | 'DEMOGRAPHIC_EXACT' 
  | 'DEMOGRAPHIC_PROBABILISTIC' 
  | 'MANUAL';

export interface MatchRecord {
  matchedIdentifier?: string;
  matchStrategy: MatchStrategy;
  confidence: number; // 0.0 - 1.0
  matchedAt: string;
  matchedBy: string; // 'SYSTEM' or userId
  decision: 'AUTO_LINKED' | 'MANUAL_LINKED' | 'REJECTED';
  details?: string;
}

export interface InternalPatientIdentity {
  internalPatientId: string; // Master Person ID (UUID)
  status: 'ACTIVE' | 'MERGED' | 'INACTIVE';
  mergedInto?: string; // if merged
  
  linkedIdentifiers: PatientIdentifier[];
  
  // Demographics snapshot for probabilistic matching
  demographicProfile: {
    givenNameNormalized: string;
    familyNameNormalized: string;
    birthDate: string;
    gender: string;
    phoneNormalized?: string;
  };
  
  matchHistory: MatchRecord[];
  
  createdAt: string;
  lastUpdatedAt: string;
}

export interface DuplicateCandidate {
  id: string;
  patientId1: string;
  patientId2: string;
  confidence: number;
  scoreBreakdown: {
    nameScore: number;
    dobScore: number;
    genderScore: number;
    phoneScore?: number;
  };
  status: 'PENDING_REVIEW' | 'CONFIRMED_SAME' | 'CONFIRMED_DIFFERENT';
  flaggedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}
