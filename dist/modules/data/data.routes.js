import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { requirePermission } from '../../security/authorize.js';
export function createDataRoutes(rawStore, mpi, terminologyService, provenanceService, engine, canonicalStore) {
    const router = Router();
    router.get('/raw-store', verifyToken, requirePermission('AUDIT_READ_CENTRAL', 'AUDIT_READ_ORG'), async (req, res) => {
        res.json(await rawStore.getAll());
    });
    router.post('/raw-store/:id/reprocess', verifyToken, requirePermission('ORG_MANAGE_ALL', 'IMPORT_EXECUTE_ORG'), async (req, res) => {
        try {
            res.json({ success: true, result: await engine.reprocessRecord(req.params.id, req.body.customConfig) });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    router.get('/mpi/identities', verifyToken, requirePermission('PATIENT_READ_ALL', 'PATIENT_READ_ORG', 'AUDIT_READ_CENTRAL'), async (req, res) => {
        res.json(await mpi.getAllIdentities());
    });
    router.get('/mpi/duplicate-candidates', verifyToken, requirePermission('PATIENT_READ_ALL', 'PATIENT_READ_ORG'), async (req, res) => {
        try {
            res.json(await mpi.findDuplicateCandidates());
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    router.post('/mpi/merge', verifyToken, requirePermission('PATIENT_READ_ALL', 'ORG_MANAGE_ALL'), async (req, res) => {
        try {
            const { survivorId, obsoleteId, reason, adminUser } = req.body;
            if (!survivorId || !obsoleteId)
                return res.status(400).json({ error: 'Both survivorId and obsoleteId are required for identity merge.' });
            const mergeResult = await mpi.mergePatientIdentities(survivorId, obsoleteId, reason || 'Clinical duplicate resolution', adminUser || 'MPI_STEWARD');
            const reassignResult = await canonicalStore.reassignPatientRecords(obsoleteId, survivorId);
            await engine.auditChain.recordEvent('PATIENT_MERGE', adminUser || 'MPI_STEWARD', 'InternalPatientIdentity', survivorId, `Merged patient [${obsoleteId}] into survivor [${survivorId}]. Reassigned records: ${JSON.stringify(reassignResult)}`);
            res.json({ success: true, message: `Successfully merged patient [${obsoleteId}] into [${survivorId}].`, merge: mergeResult, reassignedRecords: reassignResult });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    router.post('/mpi/unmerge', verifyToken, requirePermission('PATIENT_READ_ALL', 'ORG_MANAGE_ALL'), async (req, res) => {
        try {
            const { survivorId, obsoleteId, reason, adminUser } = req.body;
            if (!survivorId || !obsoleteId)
                return res.status(400).json({ error: 'Both survivorId and obsoleteId are required for identity unmerge.' });
            const unmergeResult = await mpi.unmergePatientIdentities(survivorId, obsoleteId, reason || 'Identities were incorrectly linked', adminUser || 'MPI_STEWARD');
            engine.auditChain.recordEvent('PATIENT_UNMERGE', adminUser || 'MPI_STEWARD', 'InternalPatientIdentity', survivorId, `Unmerged patient [${obsoleteId}] from survivor [${survivorId}]. Reason: ${reason}`);
            res.json({ success: true, message: `Successfully unmerged patient [${obsoleteId}] from [${survivorId}].`, unmerge: unmergeResult });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    router.get('/terminology/concepts', verifyToken, async (req, res) => { res.json(await terminologyService.getAllConcepts()); });
    router.get('/mappings', verifyToken, async (req, res) => { res.json(engine.mappingEngine.getAllConfigurations()); });
    router.get('/provenance', verifyToken, async (req, res) => { res.json(await provenanceService.getAllProvenance()); });
    return router;
}
//# sourceMappingURL=data.routes.js.map