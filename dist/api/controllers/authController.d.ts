import { Request, Response } from 'express';
interface AuthRequest extends Request {
    user?: {
        uid: string;
        email: string;
        role?: string;
        [key: string]: any;
    };
}
export declare const getCurrentUser: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateUser: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getAllUsers: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateUserRole: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createUserFromAuth: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export {};
