import { Request, Response } from 'express';
export declare const submitPublicCandidate: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPublicJobDetails: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
