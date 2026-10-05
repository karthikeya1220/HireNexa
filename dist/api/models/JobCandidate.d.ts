import mongoose, { Document, Types } from 'mongoose';
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
        end?: string;
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
    timestamp: Date;
    updatedBy: string;
    additionalData?: Record<string, unknown>;
}
export interface ITracking {
    status: string;
    statusHistory: IStatusHistoryEntry[];
    lastUpdated: Date;
    updatedBy: string;
    rateConfirmed?: number;
    interviewDate?: string;
    contactedDate?: string;
    notes?: string;
    additionalData?: Record<string, unknown>;
}
export interface ICandidate extends Document {
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
    jobId: Types.ObjectId;
    userId: string;
    userEmail?: string;
    created_at: Date;
    updated_at: Date;
}
declare const JobCandidate: mongoose.Model<any, {}, {}, {}, any, any>;
export default JobCandidate;
