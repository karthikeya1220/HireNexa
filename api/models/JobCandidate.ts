// job_candidates table: interfaces kept identical to the Mongo era (the
// frontend consumes matchAnalysis/tracking camelCase), plus row <-> API mappers.

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

// Raw Postgres row (snake_case jsonb/column names).
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

export const toCandidate = (row: JobCandidateRow): ICandidate => ({
  _id: row.id,
  jobId: row.job_id,
  filename: row.filename,
  name: row.name,
  email: row.email,
  matchAnalysis: row.match_analysis,
  analysis: row.analysis,
  tracking: row.tracking ?? undefined,
  userId: row.user_id,
  userEmail: row.user_email,
  created_at: row.created_at,
  updated_at: row.updated_at,
});
