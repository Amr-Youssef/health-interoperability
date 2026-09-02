import { Request, Response, NextFunction } from 'express';
export declare const ROLE_PERMISSIONS: Record<string, string[]>;
export declare function getUserPermissions(userId: string, roleCode: string): Promise<Set<string>>;
export declare function requirePermission(...codes: string[]): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare function requireRole(...roles: string[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare function enforceOrgScope(): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
