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
export declare const addScorecard: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getScorecards: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const generateDebriefSynthesis: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
