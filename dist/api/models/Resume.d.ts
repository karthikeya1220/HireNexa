import mongoose, { Document } from 'mongoose';
export interface IAnalysis {
    name: string;
    phone_number: string;
    email: string;
    social_profile_links?: {
        linkedin?: string;
        github?: string;
        [key: string]: string | undefined;
    };
    education?: Array<{
        institution: string;
        degree: string;
        major?: string;
        location?: string;
        dates?: string;
    }>;
    work_experience?: Array<{
        company: string;
        title: string;
        location?: string;
        dates?: string;
        responsibilities?: string[];
    }>;
    skills: string[];
    key_skills?: {
        languages?: string[];
        frameworks_and_libraries?: string[];
        databases_and_orm?: string[];
        developer_tools?: string[];
        cloud_and_services?: string[];
        coursework?: string[];
        [key: string]: string[] | undefined;
    };
    project_experience?: Array<{
        name: string;
        technologies?: string[];
        link?: string;
        description?: string[];
    }>;
    profile_summary?: string;
}
export interface IResume extends Document {
    user_id: string;
    filename: string;
    filelink: string;
    fileHash: string;
    analysis: Record<string, unknown>;
    vendor_id?: string;
    vendor_name?: string;
    uploaded_at: Date;
    updated_at: Date;
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
