import { NormalizationEngine } from '../orchestration/normalization-engine.js';
import { PrismaRawStore } from '../ingestion/raw-store/prisma-raw-store.js';
import { PrismaCanonicalStore } from '../persistence/prisma-canonical-store.js';
import { PrismaMpiService } from '../mpi/prisma-mpi-service.js';
import { PrismaTerminologyService } from '../terminology/prisma-terminology-service.js';
import { PrismaProvenanceService } from '../provenance/prisma-provenance-service.js';

async function runFinalVerification() {
  console.log('🚀 Starting Final End-to-End Verification Test\n');

  // Instantiate REAL PostgreSQL-backed services
  const rawStore = new PrismaRawStore();
  const canonicalStore = new PrismaCanonicalStore();
  const mpi = new PrismaMpiService();
  const terminologyService = new PrismaTerminologyService();
  const provenanceService = new PrismaProvenanceService();

  const engine = new NormalizationEngine(
    rawStore,
    canonicalStore as any,
    mpi as any,
    terminologyService as any,
    provenanceService as any
  );
  await engine.boot();

  // Ensure Hospital C is registered
  await engine.dynamicRegistry.registerHospital({
    hospitalId: 'hospital-c',
    hospitalName: 'Hospital C (Test)',
    hospitalNameAr: 'مستشفى ج',
    facilityType: 'hospital',
    region: 'Riyadh',
    adapterVersion: '1.0',
    sourceSchema: { systemId: 'hospital-c', systemName: 'Hospital C', sourceType: 'fhir', entityTypes: ['Patient', 'Immunization'], fieldCatalog: {} },
    defaultMappingConfigs: [{
      id: 'map-fhir-patient',
      sourceSystemId: 'hospital-c',
      sourceEntityType: 'client_registry',
      targetCanonicalEntity: 'CanonicalPatient' as any,
      mappingVersion: '1.0',
      effectiveDate: '2026-01-01',
      status: 'ACTIVE',
      author: 'Test',
      description: 'Test',
      validationState: 'VALIDATED',
      fieldMappings: []
    }, {
      id: 'map-fhir-imm',
      sourceSystemId: 'hospital-c',
      sourceEntityType: 'immunizations',
      targetCanonicalEntity: 'CanonicalImmunization' as any,
      mappingVersion: '1.0',
      effectiveDate: '2026-01-01',
      status: 'ACTIVE',
      author: 'Test',
      description: 'Test',
      validationState: 'VALIDATED',
      fieldMappings: []
    }],
    createdAt: new Date().toISOString()
  });

  // ==========================================
  // Test 1: New Source Record
  // ==========================================
  console.log('📦 Test 1: Ingesting Brand New Source Record...');
  const patientIdFinal = `TEST_${Date.now()}`;
  const nid = Math.floor(1000000000 + Math.random() * 9000000000).toString(); // random 10 digit

  const uniqueName = `Final-Test-${Date.now()}`;
  const initialPayload = {
    resourceType: 'Patient',
    id: patientIdFinal,
    identifier: [{ system: 'urn:sa:nid', value: nid }],
    name: [{ family: uniqueName, given: ['First'] }],
    gender: 'male',
    birthDate: '1980-01-01'
  };

  const raw1 = await engine.ingestUploadedFile(patientIdFinal + '.json', JSON.stringify(initialPayload), 'hospital-c');
  console.log(`✅ Ingest Result: ${JSON.stringify(raw1, null, 2)}`);

  const patient1 = await engine.canonicalStore.findPatientByIdentifier(nid);
  if (!patient1) throw new Error('Test 1 Failed: Canonical Patient not found!');
  console.log(`✅ Canonical Patient persisted with Internal ID: ${patient1.internalId}`);

  // ==========================================
  // Test 2: No-Fabrication Test
  // ==========================================
  console.log('\n🧪 Test 2: No-Fabrication & Validation Rejection...');
  
  // 2a. Missing Optional Field (Telecom) -> Should NOT fabricate data
  if (patient1.phone) {
    console.log(JSON.stringify(patient1, null, 2));
    throw new Error('Test 2a Failed: Phone number was fabricated!');
  }
  console.log('✅ Missing optional field (telecom) was preserved as undefined. No fabrication.');

  // 2b. Missing Required Field -> Should reject
  // Immunization requires occurrenceDateTime (which we removed fallback for)
  const immPayloadMissingDate = {
    resourceType: 'Immunization',
    id: 'TEST_IMM_FINAL_001',
    patient: { reference: `Patient/${patientIdFinal}` },
    vax_code: 'VAC-123',
    status: 'completed'
    // MISSING occurrenceDateTime
  };
  try {
    await engine.ingestUploadedFile('TEST_IMM_FINAL_001', JSON.stringify(immPayloadMissingDate), 'hospital-c');
    throw new Error('Test 2b Failed: Validation did not reject record with missing required field!');
  } catch (error: any) {
    if (error.message.includes('Missing required field') || error.message.includes('occurrenceDateTime')) {
      console.log('✅ Missing required field triggered real validation rejection: ' + error.message);
    } else {
      throw error;
    }
  }

  // ==========================================
  // Test 3: Mapping Mutation Test
  // ==========================================
  console.log('\n📝 Test 3: Mapping Mutation & Reprocessing...');
  const updatedPayload = {
    ...initialPayload,
    name: [{ family: `${uniqueName}-Mutated`, given: ['First', 'Mutated'] }]
  };
  await engine.ingestUploadedFile(patientIdFinal + '.json', JSON.stringify(updatedPayload), 'hospital-c');
  
  const updatedPatient = await engine.canonicalStore.findPatientByIdentifier(nid);
  if (updatedPatient?.familyName !== `${uniqueName}-Mutated`) {
    throw new Error('Test 3 Failed: Canonical record did not update properly!');
  }
  console.log(`✅ Patient re-fetched, family name is now accurately mutated to: ${updatedPatient.familyName}`);

  // ==========================================
  // Test 4: Persistence Test (Restart Simulation)
  // ==========================================
  console.log('\n💾 Test 4: Persistence Survival Test...');
  const newCanonicalStore = new PrismaCanonicalStore();
  const survivedPatient = await newCanonicalStore.findPatientByIdentifier(nid);
  if (!survivedPatient || survivedPatient.familyName !== `${uniqueName}-Mutated`) {
    throw new Error('Test 4 Failed: Record did not survive component restart!');
  }
  console.log(`✅ Data persisted perfectly in PostgreSQL. Patient ${survivedPatient.internalId} survived restart.`);

  // ==========================================
  // Test 5: FHIR Verification
  // ==========================================
  console.log('\n📤 Test 5: FHIR Output Generation...');
  const fhirPatient = await engine.fhirSerializer.serializePatient(survivedPatient);
  console.log(`✅ FHIR Resource Type: ${fhirPatient.resourceType}`);
  console.log(`✅ FHIR Names Output:\n${JSON.stringify(fhirPatient.name, null, 2)}`);

  console.log('\n⛓️ Audit Chain verification...');
  const audit = await engine.auditChain.verifyChainIntegrity();
  
  if (!audit.isValid) {
    console.log(`❌ Cryptographic Audit Chain valid? FAIL (Broken at index: ${audit.brokenAtIndex}, Total blocks: ${audit.totalBlocks})`);
    throw new Error('Test 6 Failed: Cryptographic Audit Chain is INVALID!');
  } else {
    console.log(`✅ Cryptographic Audit Chain valid? PASS (Total blocks: ${audit.totalBlocks})`);
  }

  console.log('\n🎉 ALL FULL END-TO-END VERIFICATIONS COMPLETED SUCCESSFULLY!');
}

runFinalVerification().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
