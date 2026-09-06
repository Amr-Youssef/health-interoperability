/**
 * @deprecated LEGACY — Do not use in new code. Retained only until AuthorizationService parity is proven by tests.
 * This guard uses header-based spoofing (x-user-id / x-role) and NationalHealthDB (JSON file) instead of JWT+Prisma.
 * See src/security/authorize.ts and src/security/auth-middleware.ts for the canonical implementation.
 */
import { Request, Response, NextFunction } from 'express';
import { NationalHealthDB } from '../database/national-health-db.js';
import { SystemRoleCode, AuditAction } from '../database/schema.js';

export interface RequestContext {
  userId: string;
  username: string;
  roleCode: SystemRoleCode;
  organizationId: string;
  patientProfileId?: string;
  ipAddress: string;
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}

export class RbacGuard {
  private db: NationalHealthDB;

  constructor(db: NationalHealthDB) {
    this.db = db;
  }

  /**
   * Middleware: Extracts and validates user identity & role context
   */
  public extractContext = (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string);
    const roleHeader = (req.headers['x-role'] as string) || (req.query.role as string);
    const orgHeader = (req.headers['x-organization-id'] as string) || (req.query.orgId as string);
    const patientHeader = (req.headers['x-patient-id'] as string) || (req.query.patientId as string);

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    // If userId provided, verify in DB
    if (userId) {
      const user = this.db.getUser(userId);
      if (user && user.isActive) {
        req.context = {
          userId: user.id,
          username: user.username,
          roleCode: user.roleCode,
          organizationId: user.organizationId,
          patientProfileId: user.patientProfileId,
          ipAddress
        };
        return next();
      }
    }

    // Default / Header-based Context Resolution
    const roleCode = (roleHeader as SystemRoleCode) || 'HOSPITAL_ADMIN';
    const organizationId = orgHeader || 'ORG-MOH-HQ';

    req.context = {
      userId: userId || `user-${roleCode.toLowerCase()}`,
      username: `user_${roleCode.toLowerCase()}`,
      roleCode,
      organizationId,
      patientProfileId: patientHeader,
      ipAddress
    };

    next();
  };

  /**
   * Middleware: Require one of the specified system roles
   */
  public requireRole = (allowedRoles: SystemRoleCode[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.context) {
        res.status(401).json({ error: 'Unauthorized: Missing request authentication context.' });
        return;
      }

      if (!allowedRoles.includes(req.context.roleCode)) {
        this.db.logAudit(
          req.context.userId,
          req.context.organizationId,
          'SECURITY_ACCESS',
          req.path,
          'READ',
          null,
          { status: 'FORBIDDEN', reason: `Role [${req.context.roleCode}] is not allowed.` },
          req.context.ipAddress
        );

        res.status(403).json({
          error: `Forbidden: Access restricted. Role [${req.context.roleCode}] does not have required permissions.`
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware: Enforce Organization Scope
   * - Hospital Admin can only access data belonging to their organization
   * - MOH Admin has national scope
   */
  public enforceOrganizationScope = (paramName: string = 'organizationId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.context) {
        res.status(401).json({ error: 'Unauthorized: Missing authentication context.' });
        return;
      }

      const targetOrgId = req.params[paramName] || req.body[paramName] || (req.query[paramName] as string) || req.context.organizationId;

      // MOH Admin has global access
      if (req.context.roleCode === 'MOH_ADMIN') {
        return next();
      }

      // Hospital Admin must match target organization
      if (req.context.roleCode === 'HOSPITAL_ADMIN') {
        if (targetOrgId && targetOrgId !== req.context.organizationId) {
          this.db.logAudit(
            req.context.userId,
            req.context.organizationId,
            'ORGANIZATION_SCOPE_VIOLATION',
            targetOrgId,
            'READ',
            null,
            { error: 'Attempted cross-organization access' },
            req.context.ipAddress
          );

          res.status(403).json({
            error: `Forbidden: You are only authorized to access records for organization [${req.context.organizationId}].`
          });
          return;
        }
      }

      // Patient cannot access organizational administration
      if (req.context.roleCode === 'PATIENT') {
        res.status(403).json({ error: 'Forbidden: Patients cannot access organizational administrative records.' });
        return;
      }

      next();
    };
  };

  /**
   * Middleware: Enforce Patient Scope
   * - Patient can only access their own patientProfileId
   * - Hospital Admin can only access patients registered/linked to their organization
   * - MOH Admin can access under supervised audit
   */
  public enforcePatientScope = (paramName: string = 'patientId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.context) {
        res.status(401).json({ error: 'Unauthorized: Missing authentication context.' });
        return;
      }

      const targetPatientId = req.params[paramName] || req.body[paramName] || (req.query[paramName] as string);

      if (!targetPatientId) {
        return next();
      }

      // 1. Patient Role Check
      if (req.context.roleCode === 'PATIENT') {
        if (req.context.patientProfileId !== targetPatientId) {
          this.db.logAudit(
            req.context.userId,
            req.context.organizationId,
            'PATIENT_PRIVACY_VIOLATION',
            targetPatientId,
            'READ',
            null,
            { error: 'Attempted unauthorized access to another patient record' },
            req.context.ipAddress
          );

          res.status(403).json({
            error: 'Forbidden: You are only permitted to access your personal health record.'
          });
          return;
        }
      }

      // 2. Hospital Admin Check
      if (req.context.roleCode === 'HOSPITAL_ADMIN') {
        const patient = this.db.getPatient(targetPatientId);
        if (patient) {
          const linkedPatients = this.db.getPatientsByOrganization(req.context.organizationId);
          const isLinked = linkedPatients.some(p => p.id === targetPatientId);
          if (!isLinked) {
            this.db.logAudit(
              req.context.userId,
              req.context.organizationId,
              'HOSPITAL_PATIENT_SCOPE_VIOLATION',
              targetPatientId,
              'READ',
              null,
              { error: 'Patient not registered or linked to this hospital' },
              req.context.ipAddress
            );

            res.status(403).json({
              error: `Forbidden: Patient [${targetPatientId}] is not linked to your hospital [${req.context.organizationId}].`
            });
            return;
          }
        }
      }

      next();
    };
  };
}

