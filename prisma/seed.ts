import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with default data...');

  // 1. Roles
  const adminRole = await prisma.role.upsert({
    where: { role_code: 'SYS_ADMIN' },
    update: {},
    create: {
      role_name: 'System Administrator',
      role_code: 'SYS_ADMIN',
      description: 'Global system administrator',
      is_system_role: true
    }
  });

  const hospitalAdminRole = await prisma.role.upsert({
    where: { role_code: 'HOSPITAL_ADMIN' },
    update: {},
    create: {
      role_name: 'Hospital Administrator',
      role_code: 'HOSPITAL_ADMIN',
      description: 'Hospital level admin',
      is_system_role: false
    }
  });

  const patientRole = await prisma.role.upsert({
    where: { role_code: 'PATIENT' },
    update: {},
    create: {
      role_name: 'Patient',
      role_code: 'PATIENT',
      description: 'Individual Patient Access',
      is_system_role: true
    }
  });

  const mohAdminRole = await prisma.role.upsert({
    where: { role_code: 'MOH_ADMIN' },
    update: {},
    create: {
      role_name: 'MOH Administrator',
      role_code: 'MOH_ADMIN',
      description: 'Ministry of Health National Administrator - full governance',
      is_system_role: true
    }
  });

  // 2. Organizations
  const mohOrg = await prisma.organization.create({
    data: {
      organization_name: 'Ministry of Health',
      organization_name_ar: 'وزارة الصحة',
      organization_type: 'MOH',
      region: 'National'
    }
  });

  const hospA = await prisma.organization.create({
    data: {
      organization_name: 'Hospital A',
      organization_name_ar: 'مستشفى أ',
      organization_type: 'HOSPITAL',
      region: 'Riyadh'
    }
  });

  const kfmcOrg = await prisma.organization.create({
    data: {
      organization_name: 'King Fahad Medical City',
      organization_name_ar: 'مدينة الملك فهد الطبية',
      organization_type: 'HOSPITAL',
      region: 'Riyadh'
    }
  });

  const nghaOrg = await prisma.organization.create({
    data: {
      organization_name: 'National Guard Health Affairs',
      organization_name_ar: 'الشؤون الصحية بوزارة الحرس الوطني',
      organization_type: 'HOSPITAL',
      region: 'Riyadh'
    }
  });

  // 3. Default Users
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password_hash: passwordHash,
      full_name: 'System Admin',
      role_id: adminRole.id,
      organization_id: mohOrg.id
    }
  });

  const mohHash = await bcrypt.hash('moh123456', 10);
  await prisma.user.upsert({
    where: { username: 'moh_admin' },
    update: { password_hash: mohHash, role_id: mohAdminRole.id, organization_id: mohOrg.id, is_active: true },
    create: {
      username: 'moh_admin',
      password_hash: mohHash,
      full_name: 'MOH National Admin',
      role_id: mohAdminRole.id,
      organization_id: mohOrg.id,
      is_active: true
    }
  });

  const hospPasswordHash = await bcrypt.hash('pass123', 10);
  await prisma.user.upsert({
    where: { username: 'hospital_a' },
    update: {},
    create: {
      username: 'hospital_a',
      password_hash: hospPasswordHash,
      full_name: 'Hospital A Administrator',
      role_id: hospitalAdminRole.id,
      organization_id: hospA.id
    }
  });

  const patientPasswordHash = await bcrypt.hash('patient123', 10);
  
  // Create the patient profile first
  const testPatient = await prisma.patient.upsert({
    where: { internal_id: '1088445566' },
    update: {
      first_name: 'Ahmed',
      last_name: 'Al-Rashidi',
      first_name_ar: 'أحمد',
      last_name_ar: 'الرشيدي'
    },
    create: {
      internal_id: '1088445566',
      first_name: 'Ahmed',
      last_name: 'Al-Rashidi',
      first_name_ar: 'أحمد',
      last_name_ar: 'الرشيدي',
      gender: 'male',
      birth_date: new Date('1985-05-12'),
      status: 'ACTIVE'
    }
  });

  const existingIdentifier = await prisma.patientIdentifier.findFirst({
    where: { patient_id: testPatient.id, value: '1088445566' }
  });

  if (!existingIdentifier) {
    await prisma.patientIdentifier.create({
      data: {
        patient_id: testPatient.id,
        value: '1088445566',
        type: 'NID',
        system: 'urn:sa:nca:nid'
      }
    });
  }

  await prisma.user.upsert({
    where: { username: 'patient' },
    update: {
      patient_profile_id: '1088445566'
    },
    create: {
      username: 'patient',
      password_hash: patientPasswordHash,
      full_name: 'أحمد الرشيدي (Ahmed Al-Rashidi)',
      role_id: patientRole.id,
      organization_id: mohOrg.id,
      patient_profile_id: '1088445566'
    }
  });

  // 4. Terminology Concepts and Codings
  console.log('Seeding terminology concepts...');
  const concepts = [
    {
      id: 'CONCEPT-T2DM',
      preferred_term: 'Type 2 diabetes mellitus',
      preferred_term_ar: 'داء السكري من النوع الثاني',
      domain: 'DIAGNOSIS',
      codings: [
        { system: 'http://snomed.info/sct', code: '44054006', display: 'Type 2 diabetes mellitus (disorder)' },
        { system: 'urn:sa:nhic:icd-10-am', code: 'E11', display: 'Type 2 diabetes mellitus' }
      ]
    },
    {
      id: 'CONCEPT-HTN',
      preferred_term: 'Essential (primary) hypertension',
      preferred_term_ar: 'ارتفاع ضغط الدم الأولي',
      domain: 'DIAGNOSIS',
      codings: [
        { system: 'http://snomed.info/sct', code: '59621000', display: 'Essential hypertension (disorder)' },
        { system: 'urn:sa:nhic:icd-10-am', code: 'I10', display: 'Essential (primary) hypertension' }
      ]
    },
    {
      id: 'CONCEPT-HBA1C',
      preferred_term: 'Hemoglobin A1c/Hemoglobin.total in Blood',
      preferred_term_ar: 'فحص الهيموجلوبين السكري (السكر التراكمي)',
      domain: 'LAB_TEST',
      codings: [
        { system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood' }
      ]
    },
    {
      id: 'CONCEPT-MED-METFORMIN-500',
      preferred_term: 'Metformin hydrochloride 500 mg oral tablet',
      preferred_term_ar: 'ميتفورمين هيدروكلوريد 500 مجم أقراص فموية (جلوكوفاج / داياميت)',
      domain: 'MEDICATION',
      codings: [
        { system: 'http://sfda.gov.sa/sdc', code: '0628500100101', display: 'Glucophage 500mg Film-Coated Tablets (SPIMACO/Merck)' },
        { system: 'http://www.whocc.no/atc', code: 'A10BA02', display: 'Metformin' }
      ]
    }
  ];

  for (const c of concepts) {
    try {
      await prisma.terminologyConcept.upsert({
        where: { id: c.id },
        update: {},
        create: {
          id: c.id,
          preferred_term: c.preferred_term,
          preferred_term_ar: c.preferred_term_ar,
          domain: c.domain,
          codings: {
            create: c.codings
          }
        }
      });
    } catch (e) {}
  }

  // 5. Terminology Mappings
  console.log('Seeding terminology mappings...');
  const mappings = [
    { source_system_id: 'hospital-a', source_code: 'سكري-2', source_display: 'داء السكري النوع الثاني', canonical_concept_id: 'CONCEPT-T2DM' },
    { source_system_id: 'hospital-a', source_code: 'ضغط-1', source_display: 'ارتفاع ضغط الدم', canonical_concept_id: 'CONCEPT-HTN' },
    { source_system_id: 'hospital-b', source_code: 'E11.9', source_display: 'Type 2 diabetes mellitus without complications', canonical_concept_id: 'CONCEPT-T2DM' },
    { source_system_id: 'hospital-b', source_code: 'RX-MET-500', source_display: 'Metformin HCl 500mg Oral Tab', canonical_concept_id: 'CONCEPT-MED-METFORMIN-500' },
    { source_system_id: 'hospital-c', source_code: '44054006', source_display: 'Type 2 diabetes mellitus', canonical_concept_id: 'CONCEPT-T2DM' }
  ];

  for (const m of mappings) {
    try {
      const existing = await prisma.terminologyMapping.findFirst({
        where: { source_system_id: m.source_system_id, source_code: m.source_code }
      });
      if (!existing) {
        await prisma.terminologyMapping.create({
          data: {
            id: uuidv4(),
            source_system_id: m.source_system_id,
            source_code: m.source_code,
            source_display: m.source_display,
            canonical_concept_id: m.canonical_concept_id,
            equivalence: 'EQUIVALENT',
            confidence: 1.0,
            rule_version: '1.0.0'
          }
        });
      }
    } catch (e) {}
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
