import { Request, Response, NextFunction } from 'express';
export type AuthIdentity = {
    userId: string;
    roleCode: string;
    organizationId: string;
    patientProfileId?: string | null;
    user: any;
};
export declare function getIdentity(req: Request): AuthIdentity | null;
export declare function getEffectivePermissions(identity: AuthIdentity): Promise<Set<string>>;
export declare function isNationalScope(roleCode: string): boolean;
export declare function requirePermissionMW(...codes: string[]): Promise<(req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>>;
export declare function requireRoleMW(...roles: string[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare function enforceOrgScopeMW(paramName?: string): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function enforcePatientOwnershipMW(patientIdParam?: string): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
