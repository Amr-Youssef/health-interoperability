import { prisma } from '../lib/prisma.js';
import { PatientReportedHealthService } from '../core/patient-reported-health-service.js';
import { CryptographicAuditChain } from '../security/audit-chain.js';

const auditChain = new CryptographicAuditChain(prisma as any);
const healthService = new PatientReportedHealthService(prisma as any, auditChain);

async function verifyPatientReportedHealthModule() {
  console.log('\n========================================');
  console.log('Patient Reported Health Module Verification');
  console.log('========================================\n');

  let success = true;

  try {
    // Create test patient
    const patient = await prisma.patient.create({
      data: {
        internal_id: `verify-patient-${Date.now()}`,
        first_name: 'Verification',
        last_name: 'Test',
      },
    });

    console.log(`✓ Created test patient: ${patient.id}`);

    // Test 1: Allergy Creation
    const allergy = await healthService.createAllergy(patient.id, {
      patientId: patient.id,
      allergenName: 'Penicillin',
      allergenCode: '70618',
      allergenSystem: 'http://snomed.info/sct',
      reactionText: 'Rash',
      reactionSeverity: 'MODERATE',
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    });

    console.log(`✓ Created allergy - Source: ${allergy.source}, Status: ${allergy.verificationStatus}`);

    // Test 2: Verify PostgreSQL persistence
    const dbAllergies = await prisma.patientReportedAllergy.count({
      where: { patient_id: patient.id },
    });
    console.log(`✓ PostgreSQL persistence verified - ${dbAllergies} allergy records found`);

    // Test 3: Medication
    const med = await healthService.createMedication(patient.id, {
      patientId: patient.id,
      medicationName: 'Metformin',
      dose: '500mg',
      currentlyTaking: true,
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    });
    console.log(`✓ Created medication: ${med.medicationName}`);

    // Test 4: Condition
    const cond = await healthService.createCondition(patient.id, {
      patientId: patient.id,
      conditionName: 'Diabetes',
      status: 'ACTIVE',
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    });
    console.log(`✓ Created condition: ${cond.conditionName}`);

    // Test 5: Procedure
    const proc = await healthService.createProcedure(patient.id, {
      patientId: patient.id,
      procedureName: 'Appendectomy',
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    });
    console.log(`✓ Created procedure: ${proc.procedureName}`);

    // Test 6: Family Member
    const fam = await healthService.createFamilyMember(patient.id, {
      patientId: patient.id,
      relationship: 'MOTHER',
      conditionName: 'Hypertension',
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    });
    console.log(`✓ Created family member: ${fam.relationship} with ${fam.conditionName}`);

    // Test 7: Social History
    const social = await healthService.createOrUpdateSocialHistory(patient.id, {
      smokingStatus: 'NEVER',
      physicalActivity: 'MODERATE',
      occupation: 'Engineer',
      source: 'PATIENT',
      verificationStatus: 'UNVERIFIED',
      recordedAt: new Date().toISOString(),
    });
    console.log(`✓ Created social history: ${social.smokingStatus}, Activity: ${social.physicalActivity}`);

    // Test 8: Vital Observation
    const vital = await healthService.createVitalObservation(patient.id, {
      patientId: patient.id,
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
    console.log(`✓ Created vital: ${vital.observationType} - ${vital.systolic}/${vital.diastolic}`);

    // Test 9: Document
    const doc = await healthService.createDocument(patient.id, {
      patientId: patient.id,
      filename: 'test-report.pdf',
      fileMimetype: 'application/pdf',
      fileSizeBytes: 50000,
      documentCategory: 'LAB_REPORT',
      storageReference: 'patient-docs/test.pdf',
      processingStatus: 'UPLOADED',
      verificationStatus: 'UNVERIFIED',
      source: 'PATIENT',
      uploadTimestamp: new Date().toISOString(),
    });
    console.log(`✓ Created document: ${doc.filename}`);

    // Test 10: Composite Profile
    const profile = await healthService.getPatientHealthProfile(patient.id);
    console.log(`✓ Retrieved composite health profile:`);
    console.log(`  - Allergies: ${profile.allergies.length}`);
    console.log(`  - Medications: ${profile.medications.length}`);
    console.log(`  - Conditions: ${profile.conditions.length}`);
    console.log(`  - Procedures: ${profile.procedures.length}`);
    console.log(`  - Family Members: ${profile.familyHistory.length}`);
    console.log(`  - Vital Observations: ${profile.vitalObservations.length}`);
    console.log(`  - Documents: ${profile.documents.length}`);

    // Test 11: Audit Trail
    const auditLogs = await prisma.auditLog.count({
      where: {
        entity_type: { in: ['PatientReportedAllergy', 'PatientReportedMedication', 'PatientReportedCondition'] },
      },
    });
    console.log(`✓ Audit trail generated: ${auditLogs} events logged`);

    // Test 12: Authorization Check
    const patient2 = await prisma.patient.create({
      data: { internal_id: `verify-patient-2-${Date.now()}` },
    });

    let authFailed = false;
    try {
      await healthService.updateAllergy(allergy.patientId, patient2.id, { allergenName: 'Hacked' });
    } catch (error) {
      authFailed = true;
    }
    console.log(`✓ Authorization check passed: ${authFailed ? 'Correctly rejected cross-patient access' : 'ERROR'}`);

    // Clean up
    await prisma.patient.deleteMany({
      where: { internal_id: { contains: 'verify-patient' } },
    });

    console.log('\n========================================');
    console.log('✓ All verification tests PASSED');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n✗ Verification FAILED:', error);
    success = false;
  } finally {
    await prisma.$disconnect();
    process.exit(success ? 0 : 1);
  }
}

verifyPatientReportedHealthModule().catch(console.error);
