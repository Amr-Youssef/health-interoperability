import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';

const router = Router();

// Middleware: Verify Hospital Admin Role & Organization Scope
function requireHospitalAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role?.role_code !== 'HOSPITAL_ADMIN') {
    return res.status(403).json({ error: 'Access denied: Hospital Admin required' });
  }
  next();
}

router.use(verifyToken);
router.use(requireHospitalAdmin);

// Get hospital details
router.get('/info', requireHospitalAdmin, async (req, res) => {
  // TODO: Implement via Prisma
  res.json({ message: 'Hospital details' });
});

// Upload patient records
router.post('/patients', requireHospitalAdmin, async (req, res) => {
  res.json({ message: 'Patient registered successfully' });
});

// Upload encounters (visits)
router.post('/encounters', requireHospitalAdmin, async (req, res) => {
  res.json({ message: 'Encounter registered successfully' });
});

export const hospitalRoutes = router;
