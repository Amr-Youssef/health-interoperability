import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
const router = Router();
// Middleware: Verify Patient Role
function requirePatient(req, res, next) {
    if (req.user?.role?.role_code !== 'PATIENT') {
        return res.status(403).json({ error: 'Access denied: Patient required' });
    }
    next();
}
router.use(verifyToken);
router.use(requirePatient);
// Get patient's own health record
router.get('/my-record', requirePatient, async (req, res) => {
    // Enforce access control to only allow the patient to view their own ID
    res.json({ message: 'Patient Health Record' });
});
// Update patient consent
router.post('/consent', requirePatient, async (req, res) => {
    res.json({ message: 'Consent updated' });
});
export const patientRoutes = router;
//# sourceMappingURL=patient-routes.js.map