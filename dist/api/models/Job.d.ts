import mongoose, { Document } from 'mongoose';
export interface IJob extends Document {
    title: string;
    company: string;
    location: string;
    description: string;
    employment_type: string;
    experience_required: string;
    salary_range: string;
    status: string;
    requirements: string[];
    benefits: string[];
    skills_required: string[];
    nice_to_have_skills?: string[];
    working_hours?: string;
    mode_of_work?: string;
    deadline?: string;
    key_responsibilities?: string[];
    about_company?: string;
    created_at: Date;
    updated_at: Date;
    total_applications?: number;
    shortlisted?: number;
    rejected?: number;
    in_progress?: number;
    metadata?: {
        created_by?: string;
        created_by_id?: string;
        last_modified_by?: string;
    };
    assigned_recruiters?: string[];
    candidates?: Array<Record<string, unknown>>;
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
