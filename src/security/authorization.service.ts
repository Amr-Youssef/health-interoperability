import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { ROLE_PERMISSIONS, getUserPermissions } from './authorize.js';

export type AuthIdentity = {
  userId: string;
  roleCode: string;
  organizationId: string;
  patientProfileId?: string | null;
  user: any;
};

export function getIdentity(req: Request): AuthIdentity | null {
  const user: any = (req as any).user;
  if (!user) return null;
  return {
    userId: user.id,
    roleCode: user.role?.role_code || user.roleCode,
    organizationId: user.organization_id || user.organizationId,
    patientProfileId: user.patient_profile_id || null,
    user,
  };
}

export async function getEffectivePermissions(identity: AuthIdentity): Promise<Set<string>> {
  return getUserPermissions(identity.userId, identity.roleCode);
}

export function isNationalScope(roleCode: string): boolean {
  return roleCode === 'MOH_ADMIN' || roleCode === 'MOH_AUDITOR' || roleCode === 'SYS_ADMIN';
}

export async function requirePermissionMW(...codes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identity = getIdentity(req);
    if (!identity) return res.status(401).json({ error: 'Unauthorized' });
    const perms = await getEffectivePermissions(identity);
    const ok = codes.some(c => perms.has(c));
    if (!ok) {
      try {
        await prisma.auditLog.create({ data: { entity_type: 'SECURITY', entity_id: req.path, action: 'FORBIDDEN', actor_id: identity.userId, organization_id: identity.organizationId, details: `Missing permission: ${codes.join(',')} role=${identity.roleCode}` } });
      } catch {}
      return res.status(403).json({ error: `Forbidden: requires ${codes.join(' or ')}` });
    }
    next();
  };
}

export function requireRoleMW(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identity = getIdentity(req);
    if (!identity || !roles.includes(identity.roleCode)) {
      return res.status(403).json({ error: `Forbidden: role ${roles.join('/')} required` });
    }
    next();
  };
}

export function enforceOrgScopeMW(paramName?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identity = getIdentity(req);
    if (!identity) return res.status(401).json({ error: 'Unauthorized' });
    if (isNationalScope(identity.roleCode)) return next();
    const targetOrg = (paramName ? (req.params as any)[paramName] : undefined) || (req.params as any).orgId || (req.params as any).id || (req.body as any)?.organization_id || (req.query as any).orgId;
    if (targetOrg && targetOrg !== identity.organizationId) {
      return res.status(403).json({ error: 'Forbidden: cross-organization access denied' });
    }
    next();
  };
}

export function enforcePatientOwnershipMW(patientIdParam = 'patientId') {
  return (req: Request, res: Response, next: NextFunction) => {
    const identity = getIdentity(req);
    if (!identity) return res.status(401).json({ error: 'Unauthorized' });
    if (identity.roleCode !== 'PATIENT') return next();
    const target = (req.params as any)[patientIdParam] || (req.body as any)?.patient_id;
    if (target && target !== identity.patientProfileId && target !== identity.userId) {
      const byInternal = (identity.user as any)?.patient_profile_id;
      if (target !== byInternal) return res.status(403).json({ error: 'Patients can only access own record' });
    }
    next();
  };
}
