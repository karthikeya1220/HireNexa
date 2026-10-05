import mongoose, { Document, Schema } from 'mongoose';

// Define the analysis structure based on what we get from the AI model
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

const ResumeSchema = new Schema<IResume>(
  {
    user_id: { type: String, required: true },
    filename: { type: String, required: true },
    filelink: { type: String, required: true },
    fileHash: { type: String, required: true },
    analysis: { type: Schema.Types.Mixed },
    vendor_id: { type: String },
    vendor_name: { type: String },
    uploaded_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'uploaded_at', updatedAt: 'updated_at' } }
);

// Create indexes for fast lookups
ResumeSchema.index({ user_id: 1 });
ResumeSchema.index({ fileHash: 1 });

export default mongoose.models.Resume || mongoose.model<IResume>('Resume', ResumeSchema); 