import { LongitudinalRecord } from '../core/domain/longitudinal-record.js';
import { CanonicalPatient } from '../core/domain/patient.js';
import { CanonicalEncounter } from '../core/domain/encounter.js';
import { CanonicalCondition } from '../core/domain/condition.js';
import { CanonicalObservation } from '../core/domain/observation.js';
import { CanonicalMedicationRequest } from '../core/domain/medication.js';
import { CanonicalImmunization } from '../core/domain/immunization.js';
import { CanonicalAllergyIntolerance } from '../core/domain/allergy-intolerance.js';
import { CanonicalDiagnosticReport } from '../core/domain/diagnostic-report.js';
import { CanonicalCoverage, CanonicalClaim, CanonicalClaimResponse } from '../core/domain/financial.js';

export interface ICanonicalStore {
  savePatient(p: CanonicalPatient): Promise<string>;
  getPatient(internalId: string): Promise<CanonicalPatient | null>;
  getAllPatients(): Promise<CanonicalPatient[]>;
  findPatientByIdentifier(value: string): Promise<CanonicalPatient | null>;
  searchPatients?(params: { q: string; skip: number; take: number; sort: string }): Promise<{ items: CanonicalPatient[]; total: number }>;
  getLongitudinalRecord(patientId: string): Promise<LongitudinalRecord | null>;
  getAllEncounters(): Promise<CanonicalEncounter[]>;
  getEncountersByPatient(patientId: string): Promise<CanonicalEncounter[]>;
  getAllConditions(): Promise<CanonicalCondition[]>;
  getConditionsByPatient(patientId: string): Promise<CanonicalCondition[]>;
  getAllObservations(): Promise<CanonicalObservation[]>;
  getAllMedicationRequests(): Promise<CanonicalMedicationRequest[]>;
  getAllImmunizations(): Promise<CanonicalImmunization[]>;
  getAllAllergies(): Promise<CanonicalAllergyIntolerance[]>;
  getAllAllergiesByPatient?(patientId: string): Promise<CanonicalAllergyIntolerance[]>;
  getAllDiagnosticReports(): Promise<CanonicalDiagnosticReport[]>;
  getDiagnosticReportsByPatient?(patientId: string): Promise<CanonicalDiagnosticReport[]>;
  getAllCoverages(): Promise<CanonicalCoverage[]>;
  getAllClaims(): Promise<CanonicalClaim[]>;
  getClaimResponse(claimId: string): Promise<CanonicalClaimResponse | null>;
  reassignPatientRecords?(obsoleteId: string, survivorId: string): Promise<any>;
}
