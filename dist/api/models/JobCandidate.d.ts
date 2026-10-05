export interface IMatchAnalysis {
    matchPercentage: number;
    matchingSkills: string[];
    missingRequirements: string[];
    experienceMatch: boolean;
    educationMatch: boolean;
    overallAssessment?: string;
}
export interface IWorkExperience {
    company: string;
    position: string;
    duration?: {
        start: string;
        end: string;
    };
    responsibilities?: string[];
    technologies?: string[];
}
export interface IEducation {
    degree: string;
    major: string;
    institute: string;
}
export interface IStatusHistoryEntry {
    status: string;
    timestamp: Date | string;
    updatedBy: string;
    additionalData?: Record<string, unknown>;
}
export interface ITracking {
    status: string;
    statusHistory: IStatusHistoryEntry[];
    lastUpdated: Date | string;
    updatedBy: string;
    rateConfirmed?: number;
    interviewDate?: string;
    contactedDate?: string;
    notes?: string;
    additionalData?: Record<string, unknown>;
}
export interface ICandidate {
    _id: string;
    filename: string;
    name: string;
    email: string;
    matchAnalysis: IMatchAnalysis;
    analysis: {
        key_skills: string[];
        education_details: IEducation[];
        work_experience_details: IWorkExperience[];
    };
    tracking?: ITracking;
    jobId?: string;
    userId?: string | null;
    userEmail?: string | null;
    created_at: string;
    updated_at: string;
}
export interface JobCandidateRow {
    id: string;
    job_id: string;
    filename: string;
    name: string;
    email: string;
    match_analysis: IMatchAnalysis;
    analysis: ICandidate['analysis'];
    tracking?: ITracking | null;
    user_id?: string | null;
    user_email?: string | null;
    created_at: string;
    updated_at: string;
}
export declare const toCandidate: (row: JobCandidateRow) => ICandidate;
