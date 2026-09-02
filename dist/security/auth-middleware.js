import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
function getJwtSecret() {
    const s = process.env.JWT_SECRET;
    if (s && s.length >= 32)
        return s;
    if (process.env.NODE_ENV === 'production')
        throw new Error('JWT_SECRET missing or too weak (min 32 chars) - set it in .env');
    console.warn('[SECURITY] JWT_SECRET not set or weak - using dev fallback. Set JWT_SECRET in .env for production');
    return s && s.length >= 8 ? s : 'dev-only-super-secret-national-health-key-2026-not-for-prod';
}
const JWT_SECRET = getJwtSecret();
export function extractTokenFromRequest(req) {
    const h = req.headers.authorization;
    if (h && h.startsWith('Bearer '))
        return h.split(' ')[1] || null;
    const c = req.cookies?.shiep_token;
    if (c)
        return c;
    return null;
}
export function requireNationalAdmin(req, res, next) {
    const role = req.user?.role?.role_code;
    if (role !== 'MOH_ADMIN' && role !== 'SYS_ADMIN') {
        return res.status(403).json({ error: 'Access denied: National Admin (MOH/SYS) required' });
    }
    next();
}
export function requireSysAdmin(req, res, next) {
    const role = req.user?.role?.role_code;
    if (role !== 'SYS_ADMIN') {
        return res.status(403).json({ error: 'Access denied: System Admin only' });
    }
    next();
}
export function requireMohAdmin(req, res, next) {
    const role = req.user?.role?.role_code;
    if (role !== 'MOH_ADMIN' && role !== 'SYS_ADMIN') {
        return res.status(403).json({ error: 'Access denied: MOH Admin required' });
    }
    next();
}
export async function verifyToken(req, res, next) {
    const token = extractTokenFromRequest(req);
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
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
    }
    catch (error) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
}
//# sourceMappingURL=auth-middleware.js.map