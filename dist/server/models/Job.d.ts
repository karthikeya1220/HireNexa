export interface IJob {
    _id: string;
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
    nice_to_have_skills?: string[] | null;
    working_hours?: string | null;
    mode_of_work?: string | null;
    deadline?: string | null;
    key_responsibilities?: string[] | null;
    about_company?: string | null;
    created_at: string;
    updated_at: string;
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
export interface JobRow extends Omit<IJob, '_id'> {
    id: string;
}
export declare const toJob: (row: JobRow) => IJob;
export type JobWrite = Omit<JobRow, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<JobRow, 'created_at' | 'updated_at'>>;
