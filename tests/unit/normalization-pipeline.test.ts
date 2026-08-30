import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteRawStore } from '../../src/ingestion/raw-store/sqlite-raw-store.js';
import { CanonicalStore } from '../../src/persistence/canonical-store.js';
import { MasterPatientIndexService } from '../../src/mpi/mpi-service.js';
import { TerminologyService } from '../../src/terminology/terminology-service.js';
import { ProvenanceService } from '../../src/provenance/provenance-service.js';
import { NormalizationEngine } from '../../src/orchestration/normalization-engine.js';
import { FhirR4Serializer } from '../../src/fhir/fhir-serializer.js';

import { ConsentManager } from '../../src/security/consent-manager.js';
import { CryptographicAuditChain } from '../../src/security/audit-chain.js';

describe('Saudi Health Interoperability Normalization Engine (Comprehensive Architecture Test Suite - Phases 1 to 5)', () => {
  let rawStore: SqliteRawStore;
  let canonicalStore: CanonicalStore;
  let mpi: MasterPatientIndexService;
  let terminologyService: TerminologyService;
  let provenanceService: ProvenanceService;
  let engine: NormalizationEngine;
  let fhirSerializer: FhirR4Serializer;

  beforeEach(() => {
    rawStore = new SqliteRawStore(':memory:');
    canonicalStore = new CanonicalStore(null);
    mpi = new MasterPatientIndexService(null);
    terminologyService = new TerminologyService();
    provenanceService = new ProvenanceService();

    engine = new NormalizationEngine(
      rawStore,
      canonicalStore,
      mpi,
      terminologyService,
      provenanceService,
      new ConsentManager(null),
      new CryptographicAuditChain(null)
    );

    fhirSerializer = new FhirR4Serializer();
  });

  it('1. should ingest raw clinical, financial, medication and vaccine records from 3 heterogeneous hospital systems', async () => {
    const result = await engine.runFullIngestionPipeline();

    expect(result.totalIngested).toBeGreaterThanOrEqual(20);
    expect(result.sourceCounts['hospital-a']).toBeGreaterThan(0);
    expect(result.sourceCounts['hospital-b']).toBeGreaterThan(0);
    expect(result.sourceCounts['hospital-c']).toBeGreaterThan(0);

    const rawRecords = await rawStore.getAll();
    expect(rawRecords.length).toBe(result.totalIngested);

    for (const r of rawRecords) {
      expect(r.checksum).toBeDefined();
      expect(r.checksum.length).toBe(64);
    }
  });

  it('2. should resolve patient identity (MPI) across Hospitals A, B, and C to ONE master patient', async () => {
    await engine.runFullIngestionPipeline();

    const patients = await canonicalStore.getAllPatients();
    const ahmed = patients.find(p => p.identifiers.some(i => i.value === '1088445566'));
    expect(ahmed).toBeDefined();

    const identifiers = ahmed!.identifiers;
    const nid = identifiers.find(i => i.type === 'NID' && i.value === '1088445566');
    const mrnHA = identifiers.find(i => i.type === 'MRN' && i.value === 'A-10234');
    const mrnHB = identifiers.find(i => i.type === 'MRN' && i.value === 'HB-789100');
    const mrnHC = identifiers.find(i => i.type === 'MRN' && i.value === 'HC-5567');

    expect(nid).toBeDefined();
    expect(mrnHA).toBeDefined();
    expect(mrnHB).toBeDefined();
    expect(mrnHC).toBeDefined();
  });

  it('3. should perform multi-system clinical, classification, and billing terminology mapping', async () => {
    await engine.runFullIngestionPipeline();

    const conditions = await canonicalStore.getAllConditions();
    expect(conditions.length).toBeGreaterThan(0);

    // Check Hospital A local Arabic diagnosis code "سكري-2"
    const haCondition = conditions.find(c => c.code.sourceCode === 'سكري-2');
    expect(haCondition).toBeDefined();
    expect(haCondition!.code.snomedCode).toBe('44054006'); // Clinical (SNOMED CT)
    expect(haCondition!.code.icd10amCode).toBe('E11');     // Classification (ICD-10-AM)
    expect(haCondition!.code.sbsCode).toBe('SBS-E11');     // Billing (Saudi Billing System)

    // Check Lab Observations mapped to LOINC 4548-4 (HbA1c)
    const observations = await canonicalStore.getAllObservations();
    const hba1cObs = observations.filter(o => o.code.loincCode === '4548-4');
    expect(hba1cObs.length).toBeGreaterThanOrEqual(2);
  });

  it('4. should normalize ePrescriptions across hospitals and resolve to SFDA Saudi Drug Code (SDC) & ATC', async () => {
    const result = await engine.runFullIngestionPipeline();
    expect(result.medicationsCount).toBeGreaterThanOrEqual(3);

    const meds = await canonicalStore.getAllMedicationRequests();
    expect(meds.length).toBeGreaterThanOrEqual(3);

    for (const rx of meds) {
      expect(rx.medication.code.sfdaCode).toBe('0628500100101');
      expect(rx.medication.code.atcCode).toBe('A10BA02');
      expect(rx.medication.code.rxnormCode).toBe('860975');
      expect(rx.dosageInstruction.length).toBeGreaterThan(0);
      expect(rx.dispenseRequest).toBeDefined();
    }
  });

  it('5. should normalize Immunizations across hospitals and resolve to Saudi MOH Vaccine Code & CVX', async () => {
    const result = await engine.runFullIngestionPipeline();
    expect(result.immunizationsCount).toBeGreaterThanOrEqual(3);

    const immunizations = await canonicalStore.getAllImmunizations();
    expect(immunizations.length).toBeGreaterThanOrEqual(3);

    const fluVaccine = immunizations.find(i => i.vaccineCode.cvxCode === '158');
    expect(fluVaccine).toBeDefined();
    expect(fluVaccine!.status).toBe('completed');
    expect(fluVaccine!.lotNumber).toBeDefined();
    expect(fluVaccine!.expirationDate).toBeDefined();
  });

  it('6. should process insurance coverages and adjudicate eClaims in NPHIES Sandbox with CHI copay rules', async () => {
    const result = await engine.runFullIngestionPipeline();
    expect(result.coveragesCount).toBeGreaterThanOrEqual(2);
    expect(result.claimsCount).toBeGreaterThanOrEqual(3);

    const claims = await canonicalStore.getAllClaims();
    const claim = claims[0];
    expect(claim).toBeDefined();
    expect(claim.status).toBe('adjudicated');

    const claimResponse = await canonicalStore.getClaimResponse(claim.internalId);
    expect(claimResponse).toBeDefined();
    expect(claimResponse!.outcome).toBe('complete');
    expect(claimResponse!.nphiesTransactionId).toContain('NPHIES-TX-');
    expect(claimResponse!.totalApprovedSAR).toBeGreaterThan(0);
  });

  it('7. should serialize Canonical longitudinal patient record to valid HL7 FHIR R4.0.1 Bundle with SFDA MedicationRequests & Immunizations', async () => {
    await engine.runFullIngestionPipeline();

    const patients = await canonicalStore.getAllPatients();
    const ahmed = patients.find(p => p.identifiers.some(i => i.value === '1088445566'))!;
    
    const longitudinal = await canonicalStore.getLongitudinalRecord(ahmed.internalId);
    expect(longitudinal).toBeDefined();

    const fhirBundle = fhirSerializer.serializeLongitudinalBundle(longitudinal!);
    expect(fhirBundle.resourceType).toBe('Bundle');
    expect(fhirBundle.type).toBe('searchset');
    expect(fhirBundle.total).toBeGreaterThanOrEqual(15);

    // Verify MedicationRequest resource in FHIR Bundle
    const fhirMed = fhirBundle.entry.find((e: any) => e.resource.resourceType === 'MedicationRequest')?.resource;
    expect(fhirMed).toBeDefined();
    expect(fhirMed.medicationCodeableConcept.coding.some((c: any) => c.system === 'http://sfda.gov.sa/sdc')).toBe(true);

    // Verify Immunization resource in FHIR Bundle
    const fhirImm = fhirBundle.entry.find((e: any) => e.resource.resourceType === 'Immunization')?.resource;
    expect(fhirImm).toBeDefined();
    expect(fhirImm.vaccineCode.coding.some((c: any) => c.system === 'http://hl7.org/fhir/sid/cvx')).toBe(true);
  });

  it('8. should onboard a dynamic hospital and normalize custom payload through dynamic adapter', async () => {
    // 1. Dynamic Onboard
    engine.onboardHospital({
      hospitalId: 'hospital-dynamic-test',
      hospitalName: 'Jeddah International Day Surgery',
      hospitalNameAr: 'مركز جدة لجراحة اليوم الواحد',
      facilityType: 'day_surgery',
      region: 'Makkah',
      adapterVersion: '1.0.0',
      sourceSchema: {
        sourceSystemId: 'hospital-dynamic-test',
        tables: []
      },
      defaultMappingConfigs: [
        {
          id: 'map-dyn-pt',
          sourceSystemId: 'hospital-dynamic-test',
          sourceEntityType: 'patient_reg',
          targetCanonicalEntity: 'CanonicalPatient',
          mappingVersion: '1.0.0',
          effectiveDate: '2026-01-01',
          status: 'ACTIVE',
          author: 'Unit Test',
          description: 'Dynamic patient mapping',
          validationState: 'VALIDATED',
          fieldMappings: [
            { sourceField: 'p_id', targetField: 'mrn', required: true },
            { sourceField: 'nid', targetField: 'nationalId', required: true },
            { sourceField: 'name_ar', targetField: 'givenNameAr', required: true },
            { sourceField: 'gender_val', targetField: 'gender', required: true, transformation: 'gender_normalize' },
            { sourceField: 'dob', targetField: 'birthDate', required: true, transformation: 'date_normalize' }
          ]
        }
      ],
      createdAt: new Date().toISOString()
    });

    // 2. Ingest payload
    const result = await engine.ingestDynamicPayload('hospital-dynamic-test', 'patient_reg', 'JED-0091', {
      p_id: 'JED-0091',
      nid: '1088445566', // Ahmed Al-Rashidi
      name_ar: 'أحمد الراشدي',
      gender_val: 'ذكر',
      dob: '1984-04-01'
    });

    expect(result.validation.decision).toBe('ACCEPTED');
    const ahmed = (await canonicalStore.getAllPatients()).find(p => p.identifiers.some(i => i.value === '1088445566'));
    expect(ahmed).toBeDefined();
    expect(ahmed!.identifiers.some(i => i.value === 'JED-0091')).toBe(true);
  });

  it('9. should evaluate prospective ePrescription CDS Hooks safety checks and detect interactions', async () => {
    await engine.runFullIngestionPipeline();
    const patients = await canonicalStore.getAllPatients();
    const ahmed = patients.find(p => p.identifiers.some(i => i.value === '1088445566'))!;

    // 1. Prospective Metformin Trial (Duplicate warning)
    const resMetformin = await engine.cdsEngine.evaluateDraftPrescription({
      patientId: ahmed.internalId,
      drugCode: '0628500100101',
      drugName: 'Glucophage 500mg',
      dosage: '1 tab PO BID',
      route: 'oral',
      frequency: 'BID'
    });
    expect(resMetformin.cards.length).toBeGreaterThan(0);
    expect(resMetformin.cards.some(c => c.summary.includes('Duplicate') || c.summary.includes('HbA1c'))).toBe(true);

    // 2. Prospective NSAID Trial (Renal warning for diabetic)
    const resNsaid = await engine.cdsEngine.evaluateDraftPrescription({
      patientId: ahmed.internalId,
      drugCode: '0628500200202',
      drugName: 'Brufen 400mg (Ibuprofen)',
      dosage: '1 tab PO TID',
      route: 'oral',
      frequency: 'TID'
    });
    expect(resNsaid.cards.some(c => c.summary.includes('NSAID') || c.indicator === 'warning')).toBe(true);

    // 3. Prospective Ciprofloxacin Trial (Dysglycemia warning)
    const resCipro = await engine.cdsEngine.evaluateDraftPrescription({
      patientId: ahmed.internalId,
      drugCode: '0628500300303',
      drugName: 'Ciprobay 500mg (Ciprofloxacin)',
      dosage: '1 tab PO BID',
      route: 'oral',
      frequency: 'BID'
    });
    expect(resCipro.cards.some(c => c.summary.includes('Fluoroquinolone') || c.summaryAr.includes('سيبروفلوكساسين'))).toBe(true);
  });

  it('10. should maintain Cryptographic Audit Chain integrity (NCA) and execute FHIR Bulk Export ($export) with PDPL De-identification', async () => {
    await engine.runFullIngestionPipeline();

    // 1. Audit Chain Verification
    const auditStatus = engine.auditChain.verifyChainIntegrity();
    expect(auditStatus.isValid).toBe(true);
    expect(auditStatus.totalBlocks).toBeGreaterThanOrEqual(2);

    const recentEvents = engine.auditChain.getRecentEvents();
    expect(recentEvents.length).toBeGreaterThan(0);
    expect(recentEvents[0].currentHash.length).toBe(64);

    // 2. FHIR Bulk Export ($export) standard
    const bulkStandard = await engine.bulkExportService.exportBulkData({ anonymize: false });
    expect(bulkStandard.totalResourcesExported).toBeGreaterThanOrEqual(15);
    expect(bulkStandard.output.some(o => o.type === 'Patient')).toBe(true);
    expect(bulkStandard.output.some(o => o.type === 'MedicationRequest')).toBe(true);

    // 3. FHIR Bulk Export with PDPL Anonymization
    const bulkAnon = await engine.bulkExportService.exportBulkData({ anonymize: true });
    expect(bulkAnon.isAnonymized).toBe(true);
    const patientNdjson = bulkAnon.output.find(o => o.type === 'Patient')!.ndjson;
    expect(patientNdjson).not.toContain('1088445566'); // NID must be stripped
    expect(patientNdjson).toContain('ANON-');
    expect(patientNdjson).toContain('Anonymous Subject');
  });

  it('11. should ingest and normalize HL7 v2.5 pipe-delimited ADT A01 message into CanonicalPatient', async () => {
    const rawHl7 = [
      'MSH|^~\\&|HIS_LEGACY|KFH_RIYADH|SAUDI_HIE|MOH|20260401120000||ADT^A01|MSG-HL7-0099|P|2.5',
      'PID|1||1088445566^^^MOH^NID~HL7-MRN-4499^^^KFH^MR||Al-Rashidi^Ahmed||19840401|M|||Riyadh^^SAU||+966501112233',
      'PV1|1|O|Internal Medicine^Room101||||DOC-7788|||||||||||VIS-HL7-8899|||||||||||||||||||||||||20260401120000'
    ].join('\r\n');

    const result = await engine.ingestHl7v2Message(rawHl7);
    expect(result.validation.decision).toBe('ACCEPTED');
    expect(result.parsed.messageType).toBe('ADT');
    expect(result.parsed.triggerEvent).toBe('A01');

    const patients = await canonicalStore.getAllPatients();
    const ahmed = patients.find(p => p.identifiers.some(i => i.value === '1088445566'));
    expect(ahmed).toBeDefined();
    expect(ahmed!.identifiers.some(i => i.value === 'HL7-MRN-4499' || i.value === '1088445566')).toBe(true);
  });

  it('12. should provide SMART on FHIR OAuth2 discovery metadata and issue valid scoped clinical tokens', () => {
    const smartConfig = engine.smartAuth.getSmartConfiguration();
    expect(smartConfig.authorization_endpoint).toContain('/oauth/authorize');
    expect(smartConfig.token_endpoint).toContain('/oauth/token');
    expect(smartConfig.scopes_supported).toContain('patient/*.read');
    expect(smartConfig.capabilities).toContain('launch-ehr');

    // Issue SMART Token
    const tokenResp = engine.smartAuth.issueToken({
      clientId: 'sehhaty-mobile-app',
      grantType: 'authorization_code',
      patientId: '1088445566',
      scope: 'launch/patient patient/*.read'
    });

    expect(tokenResp.token_type).toBe('Bearer');
    expect(tokenResp.access_token).toContain('smart_tok_');
    expect(tokenResp.patient).toBe('1088445566');

    // Verify Token
    const verification = engine.smartAuth.verifyToken(tokenResp.access_token);
    expect(verification.isValid).toBe(true);
    expect(verification.patientId).toBe('1088445566');
    expect(verification.clientId).toBe('sehhaty-mobile-app');
  });

  it('13. should normalize AllergyIntolerance and DiagnosticReport across all sources and detect critical Penicillin allergy conflict in CDS', async () => {
    const result = await engine.runFullIngestionPipeline();
    expect(result.allergiesCount).toBeGreaterThanOrEqual(1);
    expect(result.diagnosticReportsCount).toBeGreaterThanOrEqual(1);

    const patients = await canonicalStore.getAllPatients();
    const ahmed = patients.find(p => p.identifiers.some(i => i.value === '1088445566'))!;
    expect(ahmed).toBeDefined();

    // 1. Verify allergies in CanonicalStore
    const allergies = await canonicalStore.getAllergiesByPatient(ahmed.internalId);
    expect(allergies.length).toBeGreaterThanOrEqual(1);
    expect(allergies.some(a => a.substanceCode?.snomedCode === '764146007' || a.substanceText.includes('Penicillin') || a.substanceTextAr?.includes('بنسلين'))).toBe(true);
    expect(allergies[0].criticality).toBe('high');
    expect(allergies[0].clinicalStatus).toBe('active');

    // 2. Verify diagnostic reports in CanonicalStore
    const diagnosticReports = await canonicalStore.getDiagnosticReportsByPatient(ahmed.internalId);
    expect(diagnosticReports.length).toBeGreaterThanOrEqual(1);
    expect(diagnosticReports[0].status).toBe('final');
    expect(diagnosticReports[0].code.loincCode).toBe('24323-8');

    // 3. Verify FHIR Bundle contains AllergyIntolerance and DiagnosticReport
    const longitudinal = await canonicalStore.getLongitudinalRecord(ahmed.internalId);
    const fhirBundle = fhirSerializer.serializeLongitudinalBundle(longitudinal!);
    const fhirAllergy = fhirBundle.entry.find((e: any) => e.resource.resourceType === 'AllergyIntolerance')?.resource;
    expect(fhirAllergy).toBeDefined();
    expect(fhirAllergy.criticality).toBe('high');

    const fhirReport = fhirBundle.entry.find((e: any) => e.resource.resourceType === 'DiagnosticReport')?.resource;
    expect(fhirReport).toBeDefined();
    expect(fhirReport.status).toBe('final');

    // 4. Verify Critical CDS Allergy Alert (Amoxicillin prescribed to Penicillin-allergic patient)
    const resAmox = await engine.cdsEngine.evaluateDraftPrescription({
      patientId: ahmed.internalId,
      drugCode: '0628500400404',
      drugName: 'Amoxicillin / Clavulanate 1g (Augmentin)',
      dosage: '1 tab PO BID',
      route: 'oral',
      frequency: 'BID'
    });

    expect(resAmox.cards.some(c => c.indicator === 'critical' && (c.summary.includes('ALLERGY ALERT') || c.summaryAr.includes('تحذير حساسية')))).toBe(true);
  });

  it('14. should execute Master Patient Index (MPI) Merge and Unmerge with clinical record reassignment', async () => {
    // 1. Ingest initial data
    await engine.runFullIngestionPipeline();

    // 2. Create a second patient identity
    const p2Resolution = await mpi.resolvePatientIdentity({
      sourceSystemId: 'hospital-c',
      nationalId: '1099887766',
      givenNameAr: 'سارة',
      familyNameAr: 'المنصور',
      givenName: 'Sarah',
      familyName: 'Al-Mansour',
      birthDate: '1990-05-15',
      gender: 'female',
      mrn: 'HC-PAT-9002'
    });

    const p2Id = p2Resolution.internalPatientId;
    const allPatients = await canonicalStore.getAllPatients();
    const survivorId = allPatients[0].internalId;

    // Attach an encounter to p2
    await canonicalStore.saveEncounter({
      internalId: 'enc-sarah-temp-01',
      sourceSystemId: 'hospital-c',
      sourceVisitId: 'VIS-SARAH-99',
      patientId: p2Id,
      status: 'finished',
      class: 'AMB',
      department: 'Family Medicine',
      departmentAr: 'طب الأسرة',
      period: { start: '2026-02-01T10:00:00Z', end: '2026-02-01T10:45:00Z' },
      provenance: {
        rawRecordId: 'raw-temp-1',
        sourceSystemId: 'hospital-c',
        ingestedAt: new Date().toISOString(),
        mappingVersion: '1.0.0',
        validationScore: 100,
        adapterVersion: '1.0.0'
      }
    });

    // 3. Execute Merge: Merge p2Id into survivorId
    const mergeResult = await mpi.mergePatientIdentities(
      survivorId,
      p2Id,
      'Duplicate patient record consolidated under Saudi National Identity',
      'DR_STEWARD_01'
    );

    expect(mergeResult.success).toBe(true);
    expect(mergeResult.survivor.linkedIdentifiers.some(i => i.value === '1099887766')).toBe(true);
    expect(mergeResult.obsolete.status).toBe('MERGED');
    expect(mergeResult.obsolete.mergedInto).toBe(survivorId);

    // 4. Reassign records in store
    const reassign = await canonicalStore.reassignPatientRecords(p2Id, survivorId);
    expect(reassign.encountersUpdated).toBeGreaterThanOrEqual(1);

    // Verify encounter is now linked to survivor
    const survivorEncounters = await canonicalStore.getEncountersByPatient(survivorId);
    expect(survivorEncounters.some(e => e.internalId === 'enc-sarah-temp-01')).toBe(true);

    // 5. Execute Unmerge
    const unmergeResult = await mpi.unmergePatientIdentities(
      survivorId,
      p2Id,
      'Unmerging incorrectly linked clinical identity',
      'DR_STEWARD_01'
    );

    expect(unmergeResult.success).toBe(true);
    expect(unmergeResult.restored.status).toBe('ACTIVE');
    expect(unmergeResult.restored.mergedInto).toBeUndefined();
  });

  it('15. should enforce Saudi PDPL Consent serialization and Weqaa Public Health Surveillance notifications', async () => {
    await engine.runFullIngestionPipeline();
    const patients = await canonicalStore.getAllPatients();
    const ahmed = patients[0];

    // 1. PDPL Consent Serialization
    const consent = engine.consentManager.getConsent(ahmed.internalId);
    expect(consent).toBeDefined();
    expect(consent.policy).toBe('OPT_IN_FULL');

    const fhirConsent = fhirSerializer.serializeConsent(consent);
    expect(fhirConsent.resourceType).toBe('Consent');
    expect(fhirConsent.status).toBe('active');
    expect(fhirConsent.policyRule.coding[0].system).toBe('urn:sa:sdaia:pdpl');
    expect(fhirConsent.provision.type).toBe('permit');

    // 2. Weqaa Communicable Disease Surveillance: Add a reportable Dengue Fever case
    await canonicalStore.saveCondition({
      internalId: 'cond-dengue-01',
      sourceSystemId: 'hospital-a',
      patientId: ahmed.internalId,
      code: {
        sourceCode: 'حمى الضنك',
        snomedCode: '38362002',
        snomedDisplay: 'Dengue fever (disorder)',
        icd10amCode: 'A90'
      },
      clinicalStatus: 'active',
      category: 'encounter-diagnosis',
      recordedDate: '2026-02-10T14:30:00Z',
      provenance: {
        rawRecordId: 'raw-dengue-1',
        sourceSystemId: 'hospital-a',
        ingestedAt: new Date().toISOString(),
        mappingVersion: '1.0.0',
        validationScore: 100,
        adapterVersion: '1.0.0'
      }
    });

    const reportableCases = await engine.weqaaSurveillance.detectReportableCases();
    expect(reportableCases.length).toBeGreaterThanOrEqual(1);

    const dengueCase = reportableCases.find(c => c.snomedCode === '38362002');
    expect(dengueCase).toBeDefined();
    expect(dengueCase?.urgency).toBe('URGENT_24H');
    expect(dengueCase?.diseaseNameAr).toBe('حمى الضنك');

    // 3. Generate Weqaa FHIR Notification Bundle
    const weqaaBundle = await engine.weqaaSurveillance.generateWeqaaNotificationBundle(dengueCase!.caseId);
    expect(weqaaBundle.resourceType).toBe('Bundle');
    expect(weqaaBundle.type).toBe('message');
    expect(weqaaBundle.entry[0].resource.resourceType).toBe('MessageHeader');
    expect(weqaaBundle.entry[0].resource.eventCoding.code).toBe('COMMUNICABLE_DISEASE_NOTIFICATION');

    // 4. Dispatch Case
    const dispatched = await engine.weqaaSurveillance.dispatchCaseNotification(dengueCase!.caseId);
    expect(dispatched.notificationStatus).toBe('DISPATCHED_TO_WEQAA');
    expect(dispatched.weqaaTrackingNumber).toContain('WEQAA-SA-');
  });

  const onboardLinkingTestHospital = () => {
    engine.onboardHospital({
      hospitalId: 'hospital-linking-test',
      hospitalName: 'Linking Integrity Test Hospital',
      hospitalNameAr: 'مستشفى اختبار سلامة الربط',
      facilityType: 'polyclinic',
      region: 'Riyadh',
      adapterVersion: '1.0.0',
      sourceSchema: {
        systemId: 'hospital-linking-test',
        systemName: 'مستشفى اختبار سلامة الربط',
        sourceType: 'relational',
        entityTypes: ['patient_reg', 'visit', 'diagnosis', 'policy'],
        fieldCatalog: {}
      },
      defaultMappingConfigs: [
        {
          id: 'map-lk-pt',
          sourceSystemId: 'hospital-linking-test',
          sourceEntityType: 'patient_reg',
          targetCanonicalEntity: 'CanonicalPatient',
          mappingVersion: '1.0.0',
          effectiveDate: '2026-01-01',
          status: 'ACTIVE',
          author: 'Unit Test',
          description: 'Linking test patient',
          validationState: 'VALIDATED',
          fieldMappings: [
            { sourceField: 'p_id', targetField: 'mrn', required: true },
            { sourceField: 'nid', targetField: 'nationalId', required: true },
            { sourceField: 'name', targetField: 'givenName', required: true },
            { sourceField: 'lastname', targetField: 'familyName', required: true },
            { sourceField: 'gender_val', targetField: 'gender', required: true, transformation: 'gender_normalize' },
            { sourceField: 'dob', targetField: 'birthDate', required: true, transformation: 'date_normalize' }
          ]
        },
        {
          id: 'map-lk-visit',
          sourceSystemId: 'hospital-linking-test',
          sourceEntityType: 'visit',
          targetCanonicalEntity: 'CanonicalEncounter',
          mappingVersion: '1.0.0',
          effectiveDate: '2026-01-01',
          status: 'ACTIVE',
          author: 'Unit Test',
          description: 'Linking test visit',
          validationState: 'VALIDATED',
          fieldMappings: [
            { sourceField: 'visit_id', targetField: 'sourceVisitId', required: true },
            { sourceField: 'mrn', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'admit_dt', targetField: 'period.start', required: true, transformation: 'datetime_normalize' },
            { sourceField: 'enc_type', targetField: 'class', required: true, transformation: 'encounter_type_map' }
          ]
        },
        {
          id: 'map-lk-dx',
          sourceSystemId: 'hospital-linking-test',
          sourceEntityType: 'diagnosis',
          targetCanonicalEntity: 'CanonicalCondition',
          mappingVersion: '1.0.0',
          effectiveDate: '2026-01-01',
          status: 'ACTIVE',
          author: 'Unit Test',
          description: 'Linking test diagnosis',
          validationState: 'VALIDATED',
          fieldMappings: [
            { sourceField: 'dx_id', targetField: 'sourceRecordId', required: true },
            { sourceField: 'enc_id', targetField: 'sourceVisitId', required: true },
            { sourceField: 'icd_code', targetField: 'code', required: true, terminologyMapId: 'map-hb-dx-01' }
          ]
        },
        {
          id: 'map-lk-policy',
          sourceSystemId: 'hospital-linking-test',
          sourceEntityType: 'policy',
          targetCanonicalEntity: 'CanonicalCoverage' as any,
          mappingVersion: '1.0.0',
          effectiveDate: '2026-01-01',
          status: 'ACTIVE',
          author: 'Unit Test',
          description: 'Linking test policy',
          validationState: 'VALIDATED',
          fieldMappings: [
            { sourceField: 'policy_id', targetField: 'policyNumber', required: true },
            { sourceField: 'mrn', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'payer_code', targetField: 'payerId', required: true },
            { sourceField: 'member_id', targetField: 'memberId', required: true }
          ]
        }
      ],
      createdAt: new Date().toISOString()
    });
  };

  const ingestLinkingPatient = () =>
    engine.ingestDynamicPayload('hospital-linking-test', 'patient_reg', 'LK-PT-0001', {
      p_id: 'LK-PT-0001',
      nid: '1088445566',
      name: 'Ahmed',
      lastname: 'Al-Rashidi',
      gender_val: 'M',
      dob: '1984-04-01'
    });

  it('16. should REJECT a clinical record whose encounter/visit reference does not exist (no first-patient fallback)', async () => {
    onboardLinkingTestHospital();
    await ingestLinkingPatient();

    // Same patient exists and visit LK-VIS-0001 exists, but this diagnosis
    // references a visit that was NEVER ingested -> must be rejected.
    await engine.ingestDynamicPayload('hospital-linking-test', 'visit', 'LK-VIS-0001', {
      visit_id: 'LK-VIS-0001',
      mrn: 'LK-PT-0001',
      admit_dt: '2026-03-01T10:00:00Z',
      enc_type: 'O'
    });

    const res = await engine.ingestDynamicPayload('hospital-linking-test', 'diagnosis', 'LK-DX-9999', {
      dx_id: 'LK-DX-9999',
      enc_id: 'VIS-DOES-NOT-EXIST',
      icd_code: 'E11'
    });

    expect(res.validation.decision).toBe('REJECTED');
    expect(res.validation.issues.some((i: any) => i.rule === 'REFERENTIAL_INTEGRITY')).toBe(true);
    expect(res.validation.issues.some((i: any) => i.message.includes('VIS-DOES-NOT-EXIST'))).toBe(true);

    // Nothing was persisted for the rejected record.
    const conditions = await canonicalStore.getAllConditions();
    expect(conditions.length).toBe(0);
  });

  it('17. should REJECT a record whose patient MRN does not exist (no first-patient fallback)', async () => {
    onboardLinkingTestHospital();
    await ingestLinkingPatient();

    const res = await engine.ingestDynamicPayload('hospital-linking-test', 'policy', 'LK-POL-0001', {
      policy_id: 'LK-POL-0001',
      mrn: 'UNKNOWN-MRN-555',
      payer_code: 'CHI-INS-101',
      member_id: 'MEM-X'
    });

    expect(res.validation.decision).toBe('REJECTED');
    expect(res.validation.issues.some((i: any) => i.rule === 'REFERENTIAL_INTEGRITY')).toBe(true);

    const coverages = await canonicalStore.getAllCoverages();
    expect(coverages.length).toBe(0);
  });

  it('18. should ACCEPT and correctly link a record whose visit and patient DO exist', async () => {
    onboardLinkingTestHospital();
    await ingestLinkingPatient();
    await engine.ingestDynamicPayload('hospital-linking-test', 'visit', 'LK-VIS-0001', {
      visit_id: 'LK-VIS-0001',
      mrn: 'LK-PT-0001',
      admit_dt: '2026-03-01T10:00:00Z',
      enc_type: 'O'
    });

    const res = await engine.ingestDynamicPayload('hospital-linking-test', 'diagnosis', 'LK-DX-1001', {
      dx_id: 'LK-DX-1001',
      enc_id: 'LK-VIS-0001',
      icd_code: 'E11'
    });

    expect(res.validation.decision).not.toBe('REJECTED');

    const patients = await canonicalStore.getAllPatients();
    const ahmed = patients.find(p => p.identifiers.some(i => i.value === '1088445566'))!;
    expect(ahmed).toBeDefined();

    const encounter = await canonicalStore.findEncounterBySourceVisitId('hospital-linking-test', 'LK-VIS-0001');
    expect(encounter).toBeDefined();
    expect(encounter!.patientId).toBe(ahmed.internalId);

    const conditions = await canonicalStore.getConditionsByPatient(ahmed.internalId);
    expect(conditions.length).toBe(1);
    expect(conditions[0].patientId).toBe(ahmed.internalId);
    expect(conditions[0].encounterId).toBe(encounter!.internalId);
    expect(conditions[0].code.icd10amCode).toBe('E11');
  });

  it('19. should be idempotent: re-running the same source data never duplicates canonical records', async () => {
    await engine.runFullIngestionPipeline();

    const snapshot1 = {
      encounters: (await canonicalStore.getAllEncounters()).length,
      conditions: (await canonicalStore.getAllConditions()).length,
      observations: (await canonicalStore.getAllObservations()).length,
      coverages: (await canonicalStore.getAllCoverages()).length,
      claims: (await canonicalStore.getAllClaims()).length,
      claimsResponses: 0,
      meds: (await canonicalStore.getAllMedicationRequests()).length,
      immunizations: (await canonicalStore.getAllImmunizations()).length,
      allergies: (await canonicalStore.getAllAllergies()).length,
      diagnosticReports: (await canonicalStore.getAllDiagnosticReports()).length
    };

    // Extract + normalize the same source data a second time
    await engine.runFullIngestionPipeline();

    expect(snapshot1.encounters).toBeGreaterThan(0);
    expect((await canonicalStore.getAllEncounters()).length).toBe(snapshot1.encounters);
    expect((await canonicalStore.getAllConditions()).length).toBe(snapshot1.conditions);
    expect((await canonicalStore.getAllObservations()).length).toBe(snapshot1.observations);
    expect((await canonicalStore.getAllCoverages()).length).toBe(snapshot1.coverages);
    expect((await canonicalStore.getAllClaims()).length).toBe(snapshot1.claims);
    expect((await canonicalStore.getAllMedicationRequests()).length).toBe(snapshot1.meds);
    expect((await canonicalStore.getAllImmunizations()).length).toBe(snapshot1.immunizations);
    expect((await canonicalStore.getAllAllergies()).length).toBe(snapshot1.allergies);
    expect((await canonicalStore.getAllDiagnosticReports()).length).toBe(snapshot1.diagnosticReports);

    // Exactly one adjudication response per persisted claim
    for (const claim of await canonicalStore.getAllClaims()) {
      expect(await canonicalStore.getClaimResponse(claim.internalId)).toBeDefined();
    }
  });
});

