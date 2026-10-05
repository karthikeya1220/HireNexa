export type ResumeAnalysis = {
    name?: string;
    Name?: string;
    phone_number?: string;
    email?: string;
    key_skills?: string[];
    skills?: string[];
    education_details?: unknown[];
    work_experience_details?: unknown[];
    [key: string]: unknown;
};
export type MatchAnalysis = {
    matchPercentage?: number;
    matchingSkills?: string[];
    missingRequirements?: string[];
    experienceMatch?: boolean;
    educationMatch?: boolean;
    overallAssessment?: string;
    filename?: string;
};
type ResumeLike = {
    filename?: string;
} & Record<string, unknown>;
export declare const analyzeResumeBuffer: (fileBuffer: Buffer, mimeType?: string) => Promise<ResumeAnalysis>;
export declare const analyzeMatch: (job: unknown, resume: unknown) => Promise<MatchAnalysis | null>;
export declare const analyzeBatchMatches: (jobData: unknown, resumes: ResumeLike[]) => Promise<MatchAnalysis[]>;
export {};
