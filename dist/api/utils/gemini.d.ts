export declare const analyzeResumeBuffer: (fileBuffer: Buffer, mimeType?: string) => Promise<any>;
export declare const analyzeMatch: (job: any, resume: any) => Promise<any | null>;
export declare const analyzeBatchMatches: (jobData: any, resumes: any[]) => Promise<any[]>;
