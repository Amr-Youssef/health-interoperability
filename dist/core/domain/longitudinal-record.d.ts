import { CanonicalPatient } from './patient.js';
import { CanonicalEncounter } from './encounter.js';
import { CanonicalCondition } from './condition.js';
import { CanonicalObservation } from './observation.js';
import { CanonicalCoverage, CanonicalClaim } from './financial.js';
import { CanonicalMedicationRequest } from './medication.js';
import { CanonicalImmunization } from './immunization.js';
import { CanonicalAllergyIntolerance } from './allergy-intolerance.js';
import { CanonicalDiagnosticReport } from './diagnostic-report.js';
export interface LongitudinalRecord {
    patient: CanonicalPatient;
    encounters: CanonicalEncounter[];
    conditions: CanonicalCondition[];
    observations: CanonicalObservation[];
    coverages?: CanonicalCoverage[];
    claims?: CanonicalClaim[];
    medicationRequests?: CanonicalMedicationRequest[];
    immunizations?: CanonicalImmunization[];
    allergies?: CanonicalAllergyIntolerance[];
    diagnosticReports?: CanonicalDiagnosticReport[];
}
