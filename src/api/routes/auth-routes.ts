import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../../security/auth-middleware.js';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-national-health-key-2026';

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
        orgId: user.organization_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

router.get('/me', verifyToken, (req: Request, res: Response) => {
  // req.user is injected by verifyToken middleware
  const user = req.user;
  res.json({
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role.role_code,
    organization: user.organization?.organization_name,
    orgId: user.organization_id
  });
});

export const authRoutes = router;

