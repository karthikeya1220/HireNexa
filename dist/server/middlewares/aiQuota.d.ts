import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './authMiddleware';
export declare const aiDailyQuota: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
