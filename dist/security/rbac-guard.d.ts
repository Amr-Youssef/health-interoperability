/**
 * @deprecated LEGACY — Do not use in new code. Retained only until AuthorizationService parity is proven by tests.
 * This guard uses header-based spoofing (x-user-id / x-role) and NationalHealthDB (JSON file) instead of JWT+Prisma.
 * See src/security/authorize.ts and src/security/auth-middleware.ts for the canonical implementation.
 */
import { Request, Response, NextFunction } from 'express';
import { NationalHealthDB } from '../database/national-health-db.js';
import { SystemRoleCode } from '../database/schema.js';
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
export declare class RbacGuard {
    private db;
    constructor(db: NationalHealthDB);
    /**
     * Middleware: Extracts and validates user identity & role context
     */
    extractContext: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Middleware: Require one of the specified system roles
     */
    requireRole: (allowedRoles: SystemRoleCode[]) => (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Middleware: Enforce Organization Scope
     * - Hospital Admin can only access data belonging to their organization
     * - MOH Admin has national scope
     */
    enforceOrganizationScope: (paramName?: string) => (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Middleware: Enforce Patient Scope
     * - Patient can only access their own patientProfileId
     * - Hospital Admin can only access patients registered/linked to their organization
     * - MOH Admin can access under supervised audit
     */
    enforcePatientScope: (paramName?: string) => (req: Request, res: Response, next: NextFunction) => void;
}
