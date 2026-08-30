import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}
export declare function verifyToken(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
