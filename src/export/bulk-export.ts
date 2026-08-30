import crypto from 'crypto';
import { CanonicalStore } from '../persistence/canonical-store.js';
import { FhirR4Serializer } from '../fhir/fhir-serializer.js';

export interface BulkExportResult {
  transactionTime: string;
  request: string;
  requiresAccessToken: boolean;
  output: {
    type: string;
    count: number;
    ndjson: string;
  }[];
  isAnonymized: boolean;
  totalResourcesExported: number;
}

export class FhirBulkExportService {
  private canonicalStore: CanonicalStore;
  private fhirSerializer: FhirR4Serializer;

  constructor(canonicalStore: CanonicalStore) {
    this.canonicalStore = canonicalStore;
    this.fhirSerializer = new FhirR4Serializer();
  }

  async exportBulkData(options: { anonymize?: boolean; resourceTypes?: string[] } = {}): Promise<BulkExportResult> {
    const isAnonymized = options.anonymize ?? false;
    const requestedTypes = options.resourceTypes || ['Patient', 'Encounter', 'Condition', 'Observation', 'MedicationRequest', 'Immunization', 'Coverage', 'Claim'];

    const patients = await this.canonicalStore.getAllPatients();
    const encounters = await this.canonicalStore.getAllEncounters();
    const conditions = await this.canonicalStore.getAllConditions();
    const observations = await this.canonicalStore.getAllObservations();
    const medications = await this.canonicalStore.getAllMedicationRequests();
    const immunizations = await this.canonicalStore.getAllImmunizations();
    const coverages = await this.canonicalStore.getAllCoverages();
    const claims = await this.canonicalStore.getAllClaims();

    const output: { type: string; count: number; ndjson: string }[] = [];
    let totalCount = 0;

    // 1. Patient Resources
    if (requestedTypes.includes('Patient')) {
      const serialized = patients.map(p => {
        const res = this.fhirSerializer.serializePatient(p);
        if (isAnonymized) {
          // PDPL Anonymization Protocol
          const anonHash = crypto.createHash('sha256').update(p.internalId).digest('hex').substring(0, 12);
          res.id = `anon-pt-${anonHash}`;
          res.name = [{ use: 'anonymous', text: `Anonymous Subject ${anonHash}` }];
          res.identifier = [{ system: 'urn:sa:pdpl:pseudonym', value: `ANON-${anonHash}` }];
          res.telecom = [];
          if (res.birthDate) {
            res.birthDate = res.birthDate.substring(0, 4) + '-01-01'; // Year generalization
          }
        }
        return JSON.stringify(res);
      });
      output.push({ type: 'Patient', count: serialized.length, ndjson: serialized.join('\n') });
      totalCount += serialized.length;
    }

    // 2. Encounter Resources
    if (requestedTypes.includes('Encounter')) {
      const serialized = encounters.map(e => {
        const res = this.fhirSerializer.serializeEncounter(e);
        if (isAnonymized) {
          const anonHash = crypto.createHash('sha256').update(e.patientId).digest('hex').substring(0, 12);
          res.subject = { reference: `Patient/anon-pt-${anonHash}` };
        }
        return JSON.stringify(res);
      });
      output.push({ type: 'Encounter', count: serialized.length, ndjson: serialized.join('\n') });
      totalCount += serialized.length;
    }

    // 3. Condition Resources
    if (requestedTypes.includes('Condition')) {
      const serialized = conditions.map(c => {
        const res = this.fhirSerializer.serializeCondition(c);
        if (isAnonymized) {
          const anonHash = crypto.createHash('sha256').update(c.patientId).digest('hex').substring(0, 12);
          res.subject = { reference: `Patient/anon-pt-${anonHash}` };
        }
        return JSON.stringify(res);
      });
      output.push({ type: 'Condition', count: serialized.length, ndjson: serialized.join('\n') });
      totalCount += serialized.length;
    }

    // 4. Observation Resources
    if (requestedTypes.includes('Observation')) {
      const serialized = observations.map(o => {
        const res = this.fhirSerializer.serializeObservation(o);
        if (isAnonymized) {
          const anonHash = crypto.createHash('sha256').update(o.patientId).digest('hex').substring(0, 12);
          res.subject = { reference: `Patient/anon-pt-${anonHash}` };
        }
        return JSON.stringify(res);
      });
      output.push({ type: 'Observation', count: serialized.length, ndjson: serialized.join('\n') });
      totalCount += serialized.length;
    }

    // 5. MedicationRequest Resources
    if (requestedTypes.includes('MedicationRequest')) {
      const serialized = medications.map(m => {
        const res = this.fhirSerializer.serializeMedicationRequest(m);
        if (isAnonymized) {
          const anonHash = crypto.createHash('sha256').update(m.patientId).digest('hex').substring(0, 12);
          res.subject = { reference: `Patient/anon-pt-${anonHash}` };
        }
        return JSON.stringify(res);
      });
      output.push({ type: 'MedicationRequest', count: serialized.length, ndjson: serialized.join('\n') });
      totalCount += serialized.length;
    }

    // 6. Immunization Resources
    if (requestedTypes.includes('Immunization')) {
      const serialized = immunizations.map(i => {
        const res = this.fhirSerializer.serializeImmunization(i);
        if (isAnonymized) {
          const anonHash = crypto.createHash('sha256').update(i.patientId).digest('hex').substring(0, 12);
          res.patient = { reference: `Patient/anon-pt-${anonHash}` };
        }
        return JSON.stringify(res);
      });
      output.push({ type: 'Immunization', count: serialized.length, ndjson: serialized.join('\n') });
      totalCount += serialized.length;
    }

    // 7. Coverage Resources
    if (requestedTypes.includes('Coverage')) {
      const serialized = coverages.map(c => {
        const res = this.fhirSerializer.serializeCoverage(c);
        if (isAnonymized) {
          const anonHash = crypto.createHash('sha256').update(c.patientId).digest('hex').substring(0, 12);
          res.beneficiary = { reference: `Patient/anon-pt-${anonHash}` };
          res.subscriberId = `ANON-MEM-${anonHash.substring(0, 6)}`;
        }
        return JSON.stringify(res);
      });
      output.push({ type: 'Coverage', count: serialized.length, ndjson: serialized.join('\n') });
      totalCount += serialized.length;
    }

    // 8. Claim Resources
    if (requestedTypes.includes('Claim')) {
      const serialized = claims.map(clm => {
        const res = this.fhirSerializer.serializeClaim(clm);
        if (isAnonymized) {
          const anonHash = crypto.createHash('sha256').update(clm.patientId).digest('hex').substring(0, 12);
          res.patient = { reference: `Patient/anon-pt-${anonHash}` };
        }
        return JSON.stringify(res);
      });
      output.push({ type: 'Claim', count: serialized.length, ndjson: serialized.join('\n') });
      totalCount += serialized.length;
    }

    return {
      transactionTime: new Date().toISOString(),
      request: options.anonymize ? 'GET /fhir/$export?_type=all&anonymize=true' : 'GET /fhir/$export',
      requiresAccessToken: true,
      output,
      isAnonymized,
      totalResourcesExported: totalCount
    };
  }
}
