import { prisma } from '../src/lib/prisma.js';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log('P6 fill: Patient.internal_id_uuid');
  const patients = await prisma.patient.findMany({ where: { internal_id_uuid: null } });
  for (const p of patients) {
    const newUuid = uuidv4();
    await prisma.patient.update({ where: { id: p.id }, data: { internal_id_uuid: newUuid } });
    console.log(`  ${p.internal_id} -> ${newUuid}`);
  }
  console.log(`  Done ${patients.length} patients`);

  const models: Array<{ name: string; delegate: any }> = [
    { name: 'Encounter', delegate: prisma.encounter },
    { name: 'Condition', delegate: prisma.condition },
    { name: 'Observation', delegate: prisma.observation },
    { name: 'MedicationRequest', delegate: prisma.medicationRequest },
    { name: 'Immunization', delegate: prisma.immunization },
    { name: 'Coverage', delegate: prisma.coverage },
    { name: 'Claim', delegate: prisma.claim },
    { name: 'AllergyIntolerance', delegate: prisma.allergyIntolerance },
    { name: 'DiagnosticReport', delegate: prisma.diagnosticReport },
    { name: 'Consent', delegate: prisma.consent },
    { name: 'Appointment', delegate: prisma.appointment },
  ];

  for (const m of models) {
    console.log(`P6 fill: ${m.name}.patient_id_uuid`);
    const rows: any[] = await m.delegate.findMany({ where: { patient_id_uuid: null } });
    let filled = 0;
    for (const r of rows) {
      const pat = await prisma.patient.findFirst({ where: { internal_id: r.patient_id } });
      if (pat) {
        await m.delegate.update({ where: { id: r.id }, data: { patient_id_uuid: pat.id } });
        filled++;
      }
    }
    console.log(`  ${m.name}: ${filled}/${rows.length} filled`);
  }
  console.log('P6 fill complete');
}

main().catch(e=>{ console.error(e); process.exit(1)}).finally(()=> prisma.$disconnect());
