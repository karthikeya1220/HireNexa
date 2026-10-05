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
export declare const analyzeAndUpload: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const streamResumeToClient: (res: Response, resume: {
    user_id: string;
    filename: string;
}, asDownload: boolean) => Promise<Response<any, Record<string, any>>>;
export declare const getResumeContent: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getResumeDownload: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const checkDuplicateResume: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const saveResume: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getUserResumes: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getResumeById: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteResume: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getAllResumes: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getFeedback: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const addFeedback: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export {};
