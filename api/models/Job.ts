import mongoose, { Document, Schema } from 'mongoose';

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

const JobSchema = new Schema<IJob>(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, required: true },
    description: { type: String, required: true },
    employment_type: { type: String, required: true },
    experience_required: { type: String, required: true },
    salary_range: { type: String, required: true },
    status: { type: String, required: true, default: 'active', enum: ['active', 'inactive'] },
    requirements: { type: [String], required: true },
    benefits: { type: [String], required: true },
    skills_required: { type: [String], required: true },
    nice_to_have_skills: { type: [String] },
    working_hours: { type: String },
    mode_of_work: { type: String },
    deadline: { type: String },
    key_responsibilities: { type: [String] },
    about_company: { type: String },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    total_applications: { type: Number, default: 0 },
    shortlisted: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
    in_progress: { type: Number, default: 0 },
    metadata: {
      created_by: { type: String },
      created_by_id: { type: String },
      last_modified_by: { type: String },
    },
    assigned_recruiters: { type: [String], default: [] },
    candidates: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.models.Job || mongoose.model<IJob>('Job', JobSchema); 