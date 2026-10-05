interface ResumeAnalysis {
    skills?: string[];
    experience?: Record<string, unknown>;
    education?: Record<string, unknown>;
}
interface FetchParams {
    url: string;
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    skipAuth?: boolean;
}
interface UserData {
    uid: string;
    email: string;
    name?: string;
    role?: string;
}
interface ResumeData {
    _id?: string;
    user_id: string;
    filename: string;
    filelink: string;
    fileHash: string;
    analysis: ResumeAnalysis;
    vendor_id?: string;
    vendor_name?: string;
    uploaded_at?: Date;
    updated_at?: Date;
}
interface VendorData {
    _id?: string;
    name: string;
    address?: string;
    contact_person?: string;
    country?: string;
    email?: string;
    phone?: string;
    state?: string;
    status?: string;
}
interface JobData {
    _id?: string;
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
    updated_at?: Date;
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
}
export declare const fetcher: ({ url, method, body, headers, skipAuth }: FetchParams) => Promise<unknown>;
declare const apiClient: {
    auth: {
        getCurrentUser: () => Promise<unknown>;
        updateUser: (data: Partial<UserData>) => Promise<unknown>;
        getAllUsers: () => Promise<unknown>;
        updateUserRole: (data: {
            uid: string;
            role: string;
        }) => Promise<unknown>;
        createFromAuth: (data: {
            uid: string;
            email: string;
            name?: string;
        }) => Promise<unknown>;
    };
    resumes: {
        checkDuplicate: (fileHash: string, userId: string) => Promise<unknown>;
        saveResume: (resumeData: Omit<ResumeData, "_id">) => Promise<unknown>;
        getAllResumes: () => Promise<unknown>;
        getUserResumes: (id: string) => Promise<unknown>;
        getResume: (id: string) => Promise<unknown>;
        deleteResume: (id: string) => Promise<unknown>;
        getAllForMatching: () => Promise<unknown>;
        getResumeContent: (id: string) => Promise<{
            data: ArrayBuffer;
        }>;
        downloadResume: (id: string) => Promise<{
            data: ArrayBuffer;
        }>;
    };
    vendors: {
        getAll: () => Promise<unknown>;
        getById: (id: string) => Promise<unknown>;
        create: (data: Omit<VendorData, "_id">) => Promise<unknown>;
        update: (id: string, data: Partial<VendorData>) => Promise<unknown>;
        delete: (id: string) => Promise<unknown>;
    };
    jobs: {
        getAll: () => Promise<unknown>;
        getById: (id: string) => Promise<unknown>;
        create: (data: Omit<JobData, "_id">) => Promise<unknown>;
        update: (id: string, data: Partial<JobData>) => Promise<unknown>;
        delete: (id: string) => Promise<unknown>;
        getCandidates: (jobId: string) => Promise<unknown>;
        saveCandidates: (jobId: string, candidates: Record<string, unknown>[]) => Promise<unknown>;
        updateCandidateStatus: (jobId: string, candidateId: string, status: string, additionalData?: {}) => Promise<unknown>;
        assignRecruiters: (jobId: string, recruiterIds: string[]) => Promise<unknown>;
        checkForNewResumes: (jobId: string) => Promise<unknown>;
    };
};
export default apiClient;
