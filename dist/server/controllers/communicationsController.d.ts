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
export interface CandidateEmailPayload {
    candidateEmail: string;
    candidateName: string;
    type: 'interview_invitation' | 'rejection' | 'offer' | 'custom';
    jobTitle: string;
    companyName: string;
    bookingLink?: string;
    customNotes?: string;
}
/**
 * Generates context-aware, polished email templates for candidates using Gemini
 */
export declare const generateEmailDraft: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Sends and logs candidate communication into candidate's tracking timeline
 */
export declare const sendCandidateEmail: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
