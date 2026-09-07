import { Router } from 'express';
export function createAdminRoutes(canonicalStore, rawStore, mpi, engine) {
    const router = Router();
    router.post('/admin/reset-data', async (req, res) => {
        const { verifyToken: vt, requireSysAdmin } = await import('../../security/auth-middleware.js');
        let authorized = false;
        await new Promise((resolve) => { vt(req, res, () => { requireSysAdmin(req, res, () => { authorized = true; resolve(); }); }); });
        if (!authorized)
            return;
        try {
            await canonicalStore.clearAll();
            if (rawStore.clearAll)
                await rawStore.clearAll();
            await mpi.clearAll();
            engine.consentManager.clearAll();
            engine.auditChain.clearAll();
            engine.dynamicRegistry.clearAll();
            res.json({ success: true, message: 'All platform records and persistent data have been reset to a clean state.' });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    return router;
}
//# sourceMappingURL=admin.routes.js.map