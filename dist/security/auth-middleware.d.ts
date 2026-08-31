import { Request, Response, NextFunction } from 'express';
export declare function extractTokenFromRequest(req: Request): string | null;
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}
export declare function requireNationalAdmin(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
export declare function verifyToken(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
