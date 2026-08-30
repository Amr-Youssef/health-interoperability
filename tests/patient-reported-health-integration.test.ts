import { PrismaClient } from '@prisma/client';
import { PatientReportedHealthService } from '../src/core/patient-reported-health-service.js';
import { PatientReportedAllergyData } from '../src/core/domain/patient-reported-health.js';
import { CryptographicAuditChain } from '../src/security/audit-chain.js';

async function runIntegrationTests() {
  const prisma = new PrismaClient();
  const auditChain = new CryptographicAuditChain(prisma);
  const healthService = new PatientReportedHealthService(prisma, auditChain);

  console.log('\n========================================');
  console.log('Patient Reported Health Integration Tests');
  console.log('========================================\n');

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // 1. Create test patient
    console.log('TEST 1: Creating test patient...');
    const patient = await prisma.patient.create({
      data: {
        internal_id: `test-patient-${Date.now()}`,
        first_name: 'Integration',
        last_name: 'Test',
        gender: 'M',
        birth_date: new Date('1990-01-01'),
      },
    });
    const patientId = patient.id;
    console.log(`✓ Patient created: ${patientId}\n`);
    testsPassed++;

    // 2. Test allergy creation
    console.log('TEST 2: Creating allergy with PATIENT source and UNVERIFIED status...');
    const allergyData: PatientReportedAllergyData = {
      patientId,
      allergenName: 'Penicillin',
      allergenCode: '70618',
      allergenSystem: 'http://snomed.info/sct',
      reactionText: 'Rash',
      reactionSeverity: 'MODERATE',
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    };

    const allergy = await healthService.createAllergy(patientId, allergyData);
    if (allergy.source === 'PATIENT' && allergy.verificationStatus === 'UNVERIFIED') {
      console.log(`✓ Allergy created with correct source and status`);
      console.log(`  ID: ${allergy.patientId}`);
      console.log(`  Allergen: ${allergy.allergenName}`);
      console.log(`  Status: ${allergy.verificationStatus}\n`);
      testsPassed++;
    } else {
      console.error(`✗ Allergy source or status incorrect\n`);
      testsFailed++;
    }

    // 3. Test PostgreSQL persistence
    console.log('TEST 3: Verifying PostgreSQL persistence...');
    const dbAllergies = await prisma.patientReportedAllergy.findMany({
      where: { patient_id: patientId },
    });

    if (dbAllergies.length > 0 && dbAllergies[0].allergen_name === 'Penicillin') {
      console.log(`✓ Allergy persisted in PostgreSQL`);
      console.log(`  Records in DB: ${dbAllergies.length}\n`);
      testsPassed++;
    } else {
      console.error(`✗ Allergy not found in database\n`);
      testsFailed++;
    }

    // 4. Test medication creation
    console.log('TEST 4: Creating medication...');
    const medication = await healthService.createMedication(patientId, {
      patientId,
      medicationName: 'Metformin',
      dose: '500mg',
      frequency: 'Twice daily',
      currentlyTaking: true,
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    });

    if (medication.medicationName === 'Metformin') {
      console.log(`✓ Medication created successfully`);
      console.log(`  Medication: ${medication.medicationName}`);
      console.log(`  Dose: ${medication.dose}\n`);
      testsPassed++;
    } else {
      console.error(`✗ Medication creation failed\n`);
      testsFailed++;
    }

    // 5. Test authorization (patient ownership)
    console.log('TEST 5: Testing patient ownership/authorization...');
    const patient2 = await prisma.patient.create({
      data: {
        internal_id: `test-patient-2-${Date.now()}`,
        first_name: 'Other',
        last_name: 'Patient',
      },
    });

    let unauthorizedError = false;
    try {
      await healthService.updateAllergy(dbAllergies[0].id, patient2.id, { allergenName: 'Modified' });
    } catch (error: any) {
      unauthorizedError = error.message.includes('unauthorized');
    }

    if (unauthorizedError) {
      console.log(`✓ Authorization check working - patient cannot access other patient data\n`);
      testsPassed++;
    } else {
      console.error(`✗ Authorization check failed\n`);
      testsFailed++;
    }

    // 6. Test audit trail
    console.log('TEST 6: Verifying audit trail...');
    const auditLogs = await prisma.auditLog.findMany({
      where: { entity_type: 'PatientReportedAllergy' },
      orderBy: { created_at: 'desc' },
      take: 2,
    });

    if (auditLogs.length > 0) {
      console.log(`✓ Audit logs created`);
      console.log(`  Latest action: ${auditLogs[0].action}`);
      console.log(`  Logs found: ${auditLogs.length}\n`);
      testsPassed++;
    } else {
      console.error(`✗ No audit logs found\n`);
      testsFailed++;
    }

    // 7. Test health profile composite view
    console.log('TEST 7: Getting composite health profile...');
    const profile = await healthService.getPatientHealthProfile(patientId);

    if (profile.allergies && profile.medications && Array.isArray(profile.allergies)) {
      console.log(`✓ Health profile retrieved`);
      console.log(`  Allergies: ${profile.allergies.length}`);
      console.log(`  Medications: ${profile.medications.length}`);
      console.log(`  Conditions: ${profile.conditions.length}\n`);
      testsPassed++;
    } else {
      console.error(`✗ Health profile retrieval failed\n`);
      testsFailed++;
    }

    // 8. Test social history
    console.log('TEST 8: Creating social history...');
    const socialHistory = await healthService.createOrUpdateSocialHistory(patientId, {
      smokingStatus: 'NEVER',
      physicalActivity: 'MODERATE',
      occupation: 'Software Engineer',
      sleepHours: 7,
      sleepQuality: 'GOOD',
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    });

    if (socialHistory.smokingStatus === 'NEVER') {
      console.log(`✓ Social history created`);
      console.log(`  Smoking: ${socialHistory.smokingStatus}`);
      console.log(`  Activity: ${socialHistory.physicalActivity}\n`);
      testsPassed++;
    } else {
      console.error(`✗ Social history creation failed\n`);
      testsFailed++;
    }

    // 9. Test vital observations
    console.log('TEST 9: Creating vital observation...');
    const vital = await healthService.createVitalObservation(patientId, {
      patientId,
      observationType: 'BLOOD_PRESSURE',
      valueQuantity: 120,
      valueUnit: 'mmHg',
      systolic: 120,
      diastolic: 80,
      measurementMethod: 'MANUAL_ENTRY',
      recordedAt: new Date().toISOString(),
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
    });

    if (vital.observationType === 'BLOOD_PRESSURE' && vital.systolic === 120) {
      console.log(`✓ Vital observation recorded`);
      console.log(`  Type: ${vital.observationType}`);
      console.log(`  BP: ${vital.systolic}/${vital.diastolic}\n`);
      testsPassed++;
    } else {
      console.error(`✗ Vital observation creation failed\n`);
      testsFailed++;
    }

    // 10. Test document upload
    console.log('TEST 10: Creating document record...');
    const document = await healthService.createDocument(patientId, {
      patientId,
      filename: 'lab-report.pdf',
      fileMimetype: 'application/pdf',
      fileSizeBytes: 102400,
      documentCategory: 'LAB_REPORT',
      storageReference: `patient-docs/${patientId}/lab-report.pdf`,
      processingStatus: 'UPLOADED',
      verificationStatus: 'UNVERIFIED',
      source: 'PATIENT',
      uploadTimestamp: new Date().toISOString(),
    });

    if (document.filename === 'lab-report.pdf' && document.processingStatus === 'UPLOADED') {
      console.log(`✓ Document record created`);
      console.log(`  Filename: ${document.filename}`);
      console.log(`  Status: ${document.processingStatus}\n`);
      testsPassed++;
    } else {
      console.error(`✗ Document creation failed\n`);
      testsFailed++;
    }

    console.log('========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log(`✓ Passed: ${testsPassed}`);
    console.log(`✗ Failed: ${testsFailed}`);
    console.log(`Total: ${testsPassed + testsFailed}\n`);

    if (testsFailed === 0) {
      console.log('✓ All tests passed!\n');
    }
  } catch (error) {
    console.error('Test suite error:', error);
    testsFailed++;
  } finally {
    await prisma.$disconnect();
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

runIntegrationTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
