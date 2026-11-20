import { type GitHubProfileData } from './github';
export type ResumeAnalysis = {
    name?: string;
    Name?: string;
    phone_number?: string;
    email?: string;
    key_skills?: string[];
    skills?: string[];
    education_details?: unknown[];
    work_experience_details?: unknown[];
    social_profile_links?: string[];
    githubProfile?: GitHubProfileData | null;
    [key: string]: unknown;
};
export interface RubricCategoryScore {
    key: string;
    label: string;
    score: number;
    maxScore: number;
    evidence: string;
}
export interface RubricBonus {
    key: string;
    label: string;
    points: number;
    reason: string;
}
export type MatchAnalysis = {
    matchPercentage: number;
    matchingSkills: string[];
    missingRequirements: string[];
    experienceMatch: boolean;
    educationMatch: boolean;
    overallAssessment: string;
    filename?: string;
    categoryBreakdown?: RubricCategoryScore[];
    bonuses?: RubricBonus[];
    flagsOrGaps?: string[];
    githubEnrichment?: GitHubProfileData | null;
};
type ResumeLike = {
    filename?: string;
} & Record<string, unknown>;
export declare const analyzeResumeBuffer: (fileBuffer: Buffer, mimeType?: string) => Promise<ResumeAnalysis>;
export declare const analyzeMatch: (job: any, resume: any) => Promise<MatchAnalysis | null>;
export declare const analyzeBatchMatches: (jobData: unknown, resumes: ResumeLike[]) => Promise<MatchAnalysis[]>;
export {};
