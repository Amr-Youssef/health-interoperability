import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { JWT_SECRET } from '../config/jwt.js';

export function extractTokenFromRequest(req: Request): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.split(' ')[1] || null;
  const c = (req as any).cookies?.shiep_token;
  if (c) return c;
  return null;
}

// Extend Express Request to hold our user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export function requireNationalAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role?.role_code;
  if (role !== 'MOH_ADMIN' && role !== 'SYS_ADMIN') {
    return res.status(403).json({ error: 'Access denied: National Admin (MOH/SYS) required' });
  }
  next();
}

export function requireSysAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role?.role_code;
  if (role !== 'SYS_ADMIN') {
    return res.status(403).json({ error: 'Access denied: System Admin only' });
  }
  next();
}

export function requireMohAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role?.role_code;
  if (role !== 'MOH_ADMIN' && role !== 'SYS_ADMIN') {
    return res.status(403).json({ error: 'Access denied: MOH Admin required' });
  }
  next();
}

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    
    // Fetch full user and role from database to ensure they are still active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true, organization: true }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Unauthorized: User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

