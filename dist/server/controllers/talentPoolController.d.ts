import { Request, Response } from 'express';
interface AuthRequest extends Request {
    user?: {
        uid: string;
        email: string;
        name?: string;
        role?: string;
        [key: string]: unknown;
    };
}
/**
 * Finds high-affinity past candidates ("Silver Medalists") across all previous jobs
 * who reached advanced stages (interviewed, rate confirmed, approved, or shortlisted)
 * and have matching skill overlap with the current target job.
 */
export declare const getSilverMedalists: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 1-Click clone candidate from previous talent pool into current job requisition
 */
export declare const reengageCandidate: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
