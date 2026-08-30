import { NormalizationEngine } from '../orchestration/normalization-engine.js';
import { PrismaRawStore } from '../ingestion/raw-store/prisma-raw-store.js';
import { PrismaCanonicalStore } from '../persistence/prisma-canonical-store.js';
import { PrismaMpiService } from '../mpi/prisma-mpi-service.js';
import { PrismaTerminologyService } from '../terminology/prisma-terminology-service.js';
import { PrismaProvenanceService } from '../provenance/prisma-provenance-service.js';
async function runMutationTest() {
    console.log('🚀 Starting Full Lifecycle Mutation & FHIR Test for TEST_PATIENT_2026_001\n');
    const canonicalStore = new PrismaCanonicalStore();
    const engine = new NormalizationEngine(new PrismaRawStore(), canonicalStore, new PrismaMpiService(), new PrismaTerminologyService(), new PrismaProvenanceService());
    await engine.boot();
    // 1. Initial Ingestion
    console.log('📦 1. Ingesting Patient...');
    await engine.dynamicRegistry.registerHospital({
        hospitalId: 'hospital-c',
        hospitalName: 'Hospital C (Test)',
        hospitalNameAr: 'مستشفى ج',
        facilityType: 'hospital',
        region: 'Riyadh',
        adapterVersion: '1.0',
        sourceSchema: { systemId: 'hospital-c', systemName: 'Hospital C', sourceType: 'fhir', entityTypes: ['Patient'], fieldCatalog: {} },
        defaultMappingConfigs: [{
                id: 'map-fhir-patient',
                sourceSystemId: 'hospital-c',
                sourceEntityType: 'client_registry',
                targetCanonicalEntity: 'CanonicalPatient',
                mappingVersion: '1.0',
                effectiveDate: '2026-01-01',
                status: 'ACTIVE',
                author: 'Test',
                description: 'Test',
                validationState: 'VALIDATED',
                fieldMappings: [
                    { sourceField: 'id', targetField: 'mrn', required: true },
                    { sourceField: 'identifier[0].value', targetField: 'nationalId', required: false },
                    { sourceField: 'name[0].given[0]', targetField: 'givenName', required: true },
                    { sourceField: 'name[0].family', targetField: 'familyName', required: true },
                    { sourceField: 'gender', targetField: 'gender', required: false },
                    { sourceField: 'birthDate', targetField: 'birthDate', required: false }
                ]
            }],
        createdAt: new Date().toISOString()
    });
    // Also register it in engine.adapters because boot() is already called
    const adapter = await engine.dynamicRegistry.getAdapter('hospital-c');
    if (adapter) {
        engine.adapters.set('hospital-c', adapter);
        for (const config of adapter.definition.defaultMappingConfigs) {
            engine.mappingEngine.registerConfiguration(config);
        }
    }
    const initialPayload = {
        resourceType: 'Patient',
        id: 'TEST_PATIENT_2026_001',
        identifier: [{ system: 'sa:nid', value: '1099887766' }],
        name: [{ family: 'Al-Test', given: ['Mutation'] }],
        gender: 'male',
        birthDate: '1985-01-01'
    };
    await engine.ingestUploadedFile('test-patient.json', JSON.stringify(initialPayload), 'hospital-c');
    // 2. Fetch from Canonical
    console.log('🔍 2. Verifying Canonical Patient...');
    const patient1 = await engine.canonicalStore.findPatientByIdentifier('1099887766');
    if (!patient1) {
        throw new Error('Patient not found after ingestion!');
    }
    const patientId = patient1.internalId;
    console.log(`✅ Patient persisted with Internal ID: ${patientId}`);
    // 3. Modification (Reprocess)
    console.log('📝 3. Modifying & Reprocessing Patient...');
    const updatedPayload = {
        ...initialPayload,
        name: [{ family: 'Al-Test-Updated', given: ['Mutation', 'Modified'] }],
    };
    await engine.ingestUploadedFile('test-patient-updated.json', JSON.stringify(updatedPayload), 'hospital-c');
    const updatedPatient = await engine.canonicalStore.findPatientByIdentifier('1099887766');
    console.log(`✅ Patient re-fetched, family name is now: ${updatedPatient?.familyName}`);
    // 4. FHIR Bundle Construction
    console.log('📤 4. Verifying FHIR Output...');
    const fhirPatient = await engine.fhirSerializer.serializePatient(updatedPatient);
    console.log(`✅ FHIR Resource Type: ${fhirPatient.resourceType}`);
    console.log(`✅ Patient name in FHIR:\n${JSON.stringify(fhirPatient.name, null, 2)}`);
    // 5. Audit Check
    console.log('⛓️ 5. Checking NCA Audit Chain...');
    const audit = await engine.auditChain.verifyChainIntegrity();
    console.log(`✅ Audit Chain valid? ${audit.isValid} (Total blocks: ${audit.totalBlocks})`);
    console.log('\n🎉 Mutation Test Completed Successfully!');
}
runMutationTest().catch(console.error);
//# sourceMappingURL=mutation-test.js.map