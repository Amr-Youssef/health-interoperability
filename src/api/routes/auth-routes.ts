import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../../security/auth-middleware.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-national-health-key-2026';

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, full_name, roleType, organization_name } = req.body;

    if (!username || !password || !full_name || !roleType) {
      return res.status(400).json({ error: 'Username, password, full_name, and roleType are required' });
    }

    // Determine the role
    const roleCode = roleType === 'PATIENT' ? 'PATIENT' : 'HOSPITAL_ADMIN';
    let role = await prisma.role.findUnique({ where: { role_code: roleCode } });
    
    // If role doesn't exist (seed missing), create it
    if (!role) {
      role = await prisma.role.create({
        data: {
          role_name: roleCode,
          role_code: roleCode,
          is_system_role: true
        }
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    let organization_id: string;
    let patient_profile_id: string | null = null;

    if (roleCode === 'HOSPITAL_ADMIN') {
      if (!organization_name) {
        return res.status(400).json({ error: 'organization_name is required for hospitals' });
      }
      const org = await prisma.organization.create({
        data: {
          organization_name,
          organization_type: 'HOSPITAL',
          status: 'ACTIVE'
        }
      });
      organization_id = org.id;
    } else {
      // PATIENT
      // Find default MOH org or create one
      let mohOrg = await prisma.organization.findFirst({ where: { organization_type: 'MOH' } });
      if (!mohOrg) {
        mohOrg = await prisma.organization.create({
          data: {
            organization_name: 'Ministry of Health',
            organization_type: 'MOH',
            status: 'ACTIVE'
          }
        });
      }
      organization_id = mohOrg.id;

      // Create Patient profile
      const patient = await prisma.patient.create({
        data: {
          internal_id: uuidv4(),
          first_name: full_name.split(' ')[0],
          last_name: full_name.split(' ').slice(1).join(' '),
          status: 'ACTIVE'
        }
      });
      patient_profile_id = patient.id;
    }

    const user = await prisma.user.create({
      data: {
        username,
        password_hash,
        full_name,
        role_id: role.id,
        organization_id,
        patient_profile_id,
        is_active: true
      },
      include: { role: true, organization: true }
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role.role_code, orgId: user.organization_id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role.role_code,
        organization: user.organization?.organization_name,
        orgId: user.organization_id,
        patientProfileId: user.patient_profile_id
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true, organization: true }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials or inactive user' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role.role_code, orgId: user.organization_id, patientProfileId: user.patient_profile_id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role.role_code,
        organization: user.organization?.organization_name,
        orgId: user.organization_id,
        patientProfileId: user.patient_profile_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

router.get('/me', verifyToken, (req: Request, res: Response) => {
  // req.user is injected by verifyToken middleware
  const user = req.user as any;
  res.json({
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role?.role_code || 'UNKNOWN',
    organization: user.organization?.organization_name,
    orgId: user.organization_id,
    patientProfileId: user.patient_profile_id
  });
});

export const authRoutes = router;

