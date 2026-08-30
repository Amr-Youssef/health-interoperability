import { Router } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
const router = Router();
// Middleware: Verify MOH Admin Role
function requireMohAdmin(req, res, next) {
    if (req.user?.role?.role_code !== 'MOH_ADMIN') {
        return res.status(403).json({ error: 'Access denied: MOH Admin required' });
    }
    next();
}
router.use(verifyToken);
router.use(requireMohAdmin);
// Get national dashboard stats
router.get('/dashboard', requireMohAdmin, async (req, res) => {
    res.json({ message: 'National Dashboard Stats' });
});
// Get all hospitals
router.get('/hospitals', requireMohAdmin, async (req, res) => {
    res.json({ message: 'List of all registered hospitals' });
});
export const mohRoutes = router;
//# sourceMappingURL=moh-routes.js.map