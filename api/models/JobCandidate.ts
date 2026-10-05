import mongoose, { Document, Schema, Types } from 'mongoose';

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

// Create the schema
const JobCandidateSchema = new Schema<ICandidate>(
  {
    filename: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    matchAnalysis: {
      matchPercentage: { type: Number, required: true },
      matchingSkills: { type: [String], default: [] },
      missingRequirements: { type: [String], default: [] },
      experienceMatch: { type: Boolean, default: false },
      educationMatch: { type: Boolean, default: false },
      overallAssessment: { type: String },
    },
    analysis: {
      key_skills: { type: [String], default: [] },
      education_details: [
        {
          degree: { type: String },
          major: { type: String },
          institute: { type: String },
        },
      ],
      work_experience_details: [
        {
          company: { type: String },
          position: { type: String },
          duration: {
            start: { type: String },
            end: { type: String },
          },
          responsibilities: { type: [String] },
          technologies: { type: [String] },
        },
      ],
    },
    tracking: {
      status: { type: String, default: 'pending' },
      statusHistory: [
        {
          status: { type: String },
          timestamp: { type: Date, default: Date.now },
          updatedBy: { type: String },
          additionalData: { type: Schema.Types.Mixed },
        },
      ],
      lastUpdated: { type: Date, default: Date.now },
      updatedBy: { type: String },
      rateConfirmed: { type: Number },
      interviewDate: { type: String },
      contactedDate: { type: String },
      notes: { type: String },
      additionalData: { type: Schema.Types.Mixed },
    },
    // Fix for MongoDB ObjectId reference
    jobId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Job', 
      required: true 
    },
    userId: { type: String, required: true },
    userEmail: { type: String },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Compound index for fast lookups - find candidates by jobId and filename
JobCandidateSchema.index({ jobId: 1, filename: 1 }, { unique: true });

// Index for searching candidates by job
JobCandidateSchema.index({ jobId: 1 });

// Create the model directly if it doesn't already exist
const JobCandidate = mongoose.models.JobCandidate || mongoose.model<ICandidate>('JobCandidate', JobCandidateSchema);

export default JobCandidate;