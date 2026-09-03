import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SYS_ADMIN: ['ORG_MANAGE_ALL','USER_MANAGE_NATIONAL','ROLE_ASSIGN_NATIONAL','AUDIT_READ_CENTRAL','ANALYTICS_READ_NATIONAL','EXPORT_BULK_IDENTIFIED','FHIR_READ_ALL','BREAK_GLASS_EXECUTE'],
  MOH_ADMIN: ['ORG_MANAGE_ALL','ORG_APPROVE','POLICY_MANAGE','QUALITY_MONITOR','USER_MANAGE_NATIONAL','ROLE_ASSIGN_NATIONAL','AUDIT_READ_CENTRAL','ANALYTICS_READ_NATIONAL','CLINICAL_READ_ALL','FHIR_READ_ALL','CONSENT_OVERRIDE','BREAK_GLASS_EXECUTE','EXPORT_BULK_ANONYMIZED','PATIENT_READ_ALL'],
  MOH_AUDITOR: ['AUDIT_READ_CENTRAL','ANALYTICS_READ_NATIONAL','CLINICAL_READ_ALL','FHIR_READ_ALL','ACCESS_HISTORY_READ_SELF'],
  HOSPITAL_ADMIN: ['USER_MANAGE_ORG','ROLE_ASSIGN_ORG','PATIENT_MANAGE_ORG','PATIENT_READ_ORG','ENCOUNTER_CREATE_ORG','CLINICAL_WRITE_ORG','CLINICAL_READ_ORG','CLAIM_MANAGE_ORG','IMPORT_EXECUTE_ORG','AUDIT_READ_ORG','ANALYTICS_READ_ORG','FHIR_READ_ORG','BREAK_GLASS_EXECUTE','EXPORT_BULK_ANONYMIZED'],
  CLINICIAN: ['PATIENT_READ_ORG','CLINICAL_READ_ORG','CLINICAL_WRITE_ORG','ENCOUNTER_CREATE_ORG','FHIR_READ_ORG','CONSENT_MANAGE_SELF','BREAK_GLASS_EXECUTE'],
  PATIENT: ['PATIENT_READ_SELF','FHIR_READ_SELF','CONSENT_MANAGE_SELF','ACCESS_HISTORY_READ_SELF','EXPORT_BULK_ANONYMIZED'],
};

export async function getUserPermissions(userId: string, roleCode: string): Promise<Set<string>> {
  const rolePerms = ROLE_PERMISSIONS[roleCode] || [];
  const perms = new Set<string>(rolePerms);
  try {
    const dbRolePerms = await prisma.rolePermission.findMany({ where: { role: { role_code: roleCode as any } } });
    for (const rp of dbRolePerms) {
      if (rp.granted) perms.add(rp.permission_code as string);
      else perms.delete(rp.permission_code as string);
    }
    const userPerms = await prisma.userPermission.findMany({ where: { user_id: userId } });
    for (const up of userPerms) {
      if (up.granted) perms.add(up.permission_code as string);
      else perms.delete(up.permission_code as string);
    }
  } catch {}
  return perms;
}

export function requirePermission(...codes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user: any = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const roleCode = user.role?.role_code || user.roleCode;
    const perms = await getUserPermissions(user.id, roleCode);
    const ok = codes.some(c => perms.has(c));
    if (!ok) {
      try {
        await prisma.auditLog.create({ data: { entity_type: 'SECURITY', entity_id: req.path, action: 'FORBIDDEN', actor_id: user.id, organization_id: user.organization_id, details: `Missing permission: ${codes.join(',')} role=${roleCode}` } });
      } catch {}
      return res.status(403).json({ error: `Forbidden: requires ${codes.join(' or ')}` });
    }
    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user: any = (req as any).user;
    const roleCode = user?.role?.role_code || user?.roleCode;
    if (!roleCode || !roles.includes(roleCode)) {
      return res.status(403).json({ error: `Forbidden: role ${roles.join('/')} required` });
    }
    next();
  };
}

export function enforceOrgScope() {
  return (req: Request, res: Response, next: NextFunction) => {
    const user: any = (req as any).user;
    const roleCode = user?.role?.role_code;
    if (roleCode === 'MOH_ADMIN' || roleCode === 'MOH_AUDITOR' || roleCode === 'SYS_ADMIN') return next();
    const targetOrg = (req.params.orgId as string) || (req.params.id as string) || (req.body?.organization_id as string) || (req.query.orgId as string);
    if (targetOrg && targetOrg !== user.organization_id) {
      return res.status(403).json({ error: `Forbidden: cross-organization access denied` });
    }
    next();
  };
}
