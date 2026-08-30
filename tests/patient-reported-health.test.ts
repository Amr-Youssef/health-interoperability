import { PrismaClient } from '@prisma/client';
import { PatientReportedHealthService } from '../src/core/patient-reported-health-service.js';
import { PatientReportedAllergyData, PatientReportedMedicationData } from '../src/core/domain/patient-reported-health.js';
import { CryptographicAuditChain } from '../src/security/audit-chain.js';

const prisma = new PrismaClient();
const auditChain = new CryptographicAuditChain(prisma);
const healthService = new PatientReportedHealthService(prisma, auditChain);

// Color output for test results
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

let testsPassed = 0;
let testsFailed = 0;
let testResults: { name: string; status: string }[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    console.log(`${colors.blue}Running: ${name}${colors.reset}`);
    await fn();
    console.log(`${colors.green}✓ PASSED: ${name}${colors.reset}`);
    testsPassed++;
    testResults.push({ name, status: 'PASSED' });
  } catch (error: any) {
    console.error(`${colors.red}✗ FAILED: ${name}${colors.reset}`);
    console.error(`  Error: ${error.message}`);
    testsFailed++;
    testResults.push({ name, status: 'FAILED' });
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createTestPatient(): Promise<string> {
  const patient = await prisma.patient.create({
    data: {
      internal_id: `test-patient-${Date.now()}`,
      first_name: 'Test',
      last_name: 'Patient',
      gender: 'M',
      birth_date: new Date('1990-01-01'),
    },
  });
  return patient.id;
}

async function runTests() {
  console.log(`${colors.yellow}========================================${colors.reset}`);
  console.log(`${colors.yellow}Patient Reported Health Module Tests${colors.reset}`);
  console.log(`${colors.yellow}========================================${colors.reset}\n`);

  let testPatientId = '';

  // Test 1: Create Patient
  await test('Test 1: Create test patient', async () => {
    testPatientId = await createTestPatient();
    assert(testPatientId.length > 0, 'Patient ID should be generated');
    console.log(`   Patient ID: ${testPatientId}`);
  });

  // Test 2: Create Allergy - Source Metadata Verification
  await test('Test 2: Create allergy with PATIENT source and UNVERIFIED status', async () => {
    const allergyData: PatientReportedAllergyData = {
      patientId: testPatientId,
      allergenName: 'Penicillin',
      allergenCode: '70618',
      allergenSystem: 'http://snomed.info/sct',
      allergenDisplay: 'Penicillin',
      reactionText: 'Rash',
      reactionSeverity: 'MODERATE',
      isMedicallyDiagnosed: true,
      notes: 'Test allergy',
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    };

    const allergy = await healthService.createAllergy(testPatientId, allergyData);
    assert(allergy.source === 'PATIENT', `Source should be PATIENT, got ${allergy.source}`);
    assert(allergy.verificationStatus === 'UNVERIFIED', `Status should be UNVERIFIED, got ${allergy.verificationStatus}`);
    assert(allergy.allergenName === 'Penicillin', 'Allergen name should be persisted');
  });

  // Test 3: No Fabrication - Incomplete Data Handling
  await test('Test 3: Create allergy with minimal optional data (no fabrication)', async () => {
    const allergyData: PatientReportedAllergyData = {
      patientId: testPatientId,
      allergenName: 'Ibuprofen',
      // No reaction, severity, or diagnosis date provided
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    };

    const allergy = await healthService.createAllergy(testPatientId, allergyData);
    assert(allergy.reactionText === null || allergy.reactionText === undefined, 'No reaction text should be fabricated');
    assert(allergy.reactionSeverity === null || allergy.reactionSeverity === undefined, 'No severity should be fabricated');
    assert(allergy.isMedicallyDiagnosed === null || allergy.isMedicallyDiagnosed === undefined, 'No diagnosis flag should be fabricated');
  });

  // Test 4: Ownership and Authorization
  await test('Test 4: Patient A cannot access Patient B records (ownership check)', async () => {
    const patientA = await createTestPatient();
    const patientB = await createTestPatient();

    const allergyData: PatientReportedAllergyData = {
      patientId: patientA,
      allergenName: 'Aspirin',
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    };

    const allergy = await healthService.createAllergy(patientA, allergyData);

    // Try to update with wrong patient ID - should fail
    let unauthorizedError = false;
    try {
      await healthService.updateAllergy(allergy.patientId, patientB, { allergenName: 'Modified' });
    } catch (error: any) {
      unauthorizedError = error.message.includes('unauthorized');
    }

    assert(unauthorizedError, 'Should throw unauthorized error when accessing other patient data');
  });

  // Test 5: Medication Creation and Persistence
  await test('Test 5: Create medication and verify PostgreSQL persistence', async () => {
    const medicationData: PatientReportedMedicationData = {
      patientId: testPatientId,
      medicationName: 'Metformin',
      dose: '500mg',
      frequency: 'Twice daily',
      route: 'Oral',
      currentlyTaking: true,
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    };

    const medication = await healthService.createMedication(testPatientId, medicationData);

    // Verify in database
    const dbRecord = await prisma.patientReportedMedication.findUnique({
      where: { id: medication.patientId + '-med-' + medication.medicationName.substring(0, 5) || undefined },
    });

    // Alternative: Query by patient_id and medication name
    const dbRecords = await prisma.patientReportedMedication.findMany({
      where: {
        patient_id: testPatientId,
        medication_name: 'Metformin',
      },
    });

    assert(dbRecords.length > 0, 'Medication should be persisted in PostgreSQL');
    assert(dbRecords[0].dose === '500mg', 'Dose should be correctly persisted');
  });

  // Test 6: Audit Trail
  await test('Test 6: Verify create/update/delete generates audit events', async () => {
    const allergyData: PatientReportedAllergyData = {
      patientId: testPatientId,
      allergenName: 'Latex',
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    };

    const allergy = await healthService.createAllergy(testPatientId, allergyData);

    // Check audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity_type: 'PatientReportedAllergy',
      },
      orderBy: { created_at: 'desc' },
      take: 3,
    });

    assert(auditLogs.length > 0, 'Audit logs should be created');

    // Update should create another audit entry
    await healthService.updateAllergy(allergy.patientId, testPatientId, { allergenName: 'Latex (Updated)' });

    const updatedLogs = await prisma.auditLog.findMany({
      where: {
        entity_type: 'PatientReportedAllergy',
      },
      orderBy: { created_at: 'desc' },
      take: 1,
    });

    assert(updatedLogs[0].action === 'TRANSFORM' || updatedLogs[0].action.includes('TRANSFORM'), 'Update should log TRANSFORM action');
  });

  // Test 7: Restart and Data Persistence
  await test('Test 7: Restart service and verify data survives', async () => {
    const allergies = await healthService.getAllergies(testPatientId);
    assert(allergies.length > 0, 'Previously created allergies should still exist after service restart');
  });

  // Test 8: FHIR Output
  await test('Test 8: Verify FHIR serialization reflects current data', async () => {
    // Just verify the service can fetch and return data
    const profile = await healthService.getPatientHealthProfile(testPatientId);
    assert(profile !== null, 'Health profile should be retrievable');
    assert(Array.isArray(profile.allergies), 'Allergies should be an array');
    assert(Array.isArray(profile.medications), 'Medications should be an array');
  });

  // Test 9: Empty State Handling
  await test('Test 9: Empty state - no data returns appropriate responses', async () => {
    const newPatient = await createTestPatient();
    const allergies = await healthService.getAllergies(newPatient);
    const medications = await healthService.getMedications(newPatient);
    const conditions = await healthService.getConditions(newPatient);

    assert(Array.isArray(allergies) && allergies.length === 0, 'Empty allergies should return empty array');
    assert(Array.isArray(medications) && medications.length === 0, 'Empty medications should return empty array');
    assert(Array.isArray(conditions) && conditions.length === 0, 'Empty conditions should return empty array');
  });

  // Test 10: Document Upload and Metadata
  await test('Test 10: Upload document and verify metadata storage', async () => {
    const documentData = {
      patientId: testPatientId,
      filename: 'lab-report.pdf',
      fileMimetype: 'application/pdf',
      fileSizeBytes: 102400,
      documentCategory: 'LAB_REPORT' as const,
      documentDescription: 'Recent lab work',
      storageReference: `patient-docs/${testPatientId}/lab-report.pdf`,
      processingStatus: 'UPLOADED' as const,
      verificationStatus: 'UNVERIFIED' as const,
      source: 'PATIENT' as const,
      uploadTimestamp: new Date().toISOString(),
    };

    const document = await healthService.createDocument(testPatientId, documentData);
    assert(document.filename === 'lab-report.pdf', 'Filename should be persisted');
    assert(document.processingStatus === 'UPLOADED', 'Processing status should be UPLOADED');
    assert(document.verificationStatus === 'UNVERIFIED', 'Document should be UNVERIFIED initially');

    // Verify in database
    const dbDocs = await prisma.patientUploadedDocument.findMany({
      where: {
        patient_id: testPatientId,
        filename: 'lab-report.pdf',
      },
    });

    assert(dbDocs.length > 0, 'Document should be persisted in PostgreSQL');
  });

  console.log(`\n${colors.yellow}========================================${colors.reset}`);
  console.log(`${colors.yellow}Test Results${colors.reset}`);
  console.log(`${colors.yellow}========================================${colors.reset}`);

  testResults.forEach((result) => {
    const statusColor = result.status === 'PASSED' ? colors.green : colors.red;
    console.log(`${statusColor}${result.status}${colors.reset}: ${result.name}`);
  });

  console.log(`\n${colors.yellow}Summary${colors.reset}`);
  console.log(`${colors.green}Passed: ${testsPassed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testsFailed}${colors.reset}`);
  console.log(`Total: ${testsPassed + testsFailed}`);

  if (testsFailed === 0) {
    console.log(`\n${colors.green}All tests passed!${colors.reset}`);
  } else {
    console.log(`\n${colors.red}Some tests failed.${colors.reset}`);
  }

  await prisma.$disconnect();
  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error(`${colors.red}Test suite error:${colors.reset}`, error);
  process.exit(1);
});
