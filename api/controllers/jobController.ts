import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Job, { type IJob } from '../models/Job';
import JobCandidate, {
  type IEducation,
  type IMatchAnalysis,
  type ITracking,
  type IWorkExperience,
} from '../models/JobCandidate';
import Resume from '../models/Resume';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { canModifyResource, isAdminUser } from '../utils/auth-helpers';
import { analyzeBatchMatches } from '../utils/gemini';
import { streamResumeToClient } from './resumeController';

interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
    role?: string;
    [key: string]: unknown;
  };
}

// Allowed candidate pipeline statuses (mirrors the frontend CandidateStatus
// union plus the board's 'matched'/'new' placeholders).
const ALLOWED_CANDIDATE_STATUSES = new Set([
  'pending', 'new', 'matched', 'shortlisted', 'contacted', 'interested',
  'not_interested', 'rate_confirmed', 'interview_scheduled', 'approved', 'disapproved'
]);

// Job access: admins, the job creator, or recruiters assigned to the job.
// Used by every candidate read/write endpoint (previously any authenticated
// user could read/overwrite any job's pipeline).
const canAccessJob = (
  req: AuthRequest,
  job: Pick<IJob, 'metadata' | 'assigned_recruiters'> | null | undefined
): boolean => {
  if (isAdminUser(req.user?.role)) return true;
  if (job?.metadata?.created_by_id && job.metadata.created_by_id === req.user?.uid) return true;
  const uid = req.user?.uid;
  return !!uid && Array.isArray(job?.assigned_recruiters) && job.assigned_recruiters.includes(uid);
};


// Get all jobs
export const getAllJobs = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get query parameters — must be a plain string, otherwise query-string
    // operators like ?status[$ne]=x would be executed by MongoDB.
    const rawStatus = req.query.status;
    const status = typeof rawStatus === 'string' ? rawStatus : undefined;
    
    // Build query: admins see every job; everyone else only sees jobs they
    // created or were assigned to (same boundary as candidate access).
    const statusFilter = status && status !== 'all' ? { status } : {};
    const query = isAdminUser(req.user?.role)
      ? { ...statusFilter }
      : {
          $or: [
            { 'metadata.created_by_id': userId },
            { assigned_recruiters: userId },
          ],
          ...statusFilter,
        };
    
    // Find all jobs
    const jobs = await Job.find(query).sort({ created_at: -1 });
    
    res.status(200).json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

// Get job by ID
export const getJobById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const job = await Job.findById(id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.status(200).json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

// Create a new job
export const createJob = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const userEmail = req.user?.email;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Create new job with metadata — never let the client set _id or ownership
    const { _id, ...bodyFields } = req.body || {};
    const jobData = {
      ...bodyFields,
      metadata: {
        created_by: userEmail,
        created_by_id: userId,
        last_modified_by: userEmail,
      }
    };
    
    const job = new Job(jobData);
    await job.save();
    
    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
};

// Update an existing job
export const updateJob = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    const userEmail = req.user?.email;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const job = await Job.findById(id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Check if user can modify this job
    const isAuthorized = isAdminUser(userRole) || canModifyResource(userId, job.metadata?.created_by_id);
    
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized to update this job' });
    }
    
    // Update job data — strip identity/ownership fields the client must not
    // control (mixed `metadata` object + dotted path broke updates before).
    const { _id, metadata, created_at, updated_at, ...updateFields } = req.body || {};
    const updatedJobData = {
      ...updateFields,
      'metadata.last_modified_by': userEmail,
    };
    
    const updatedJob = await Job.findByIdAndUpdate(id, updatedJobData, { new: true, runValidators: true });
    
    res.status(200).json(updatedJob);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
};

// Delete a job
export const deleteJob = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const job = await Job.findById(id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Check if user can delete this job
    const isAuthorized = isAdminUser(userRole) || canModifyResource(userId, job.metadata?.created_by_id);
    
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized to delete this job' });
    }
    
    // Delete job
    await Job.findByIdAndDelete(id);
    
    // Also delete any associated candidates
    await JobCandidate.deleteMany({ jobId: id });
    
    res.status(200).json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
};

// Get job candidates
export const getJobCandidates = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Find the job to ensure it exists
    const job = await Job.findById(id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (!canAccessJob(req, job)) {
      return res.status(403).json({ error: 'Not authorized to view candidates for this job' });
    }
    
    // Find candidates from the JobCandidate collection
    const candidates = await JobCandidate.find({ jobId: id }).sort({ 'matchAnalysis.matchPercentage': -1 });
    
    res.status(200).json(candidates);
  } catch (error) {
    console.error('Error fetching job candidates:', error);
    res.status(500).json({ error: 'Failed to fetch job candidates' });
  }
};

// Save a list of analyzed candidate matches to the database
export const saveJobCandidates = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { candidates } = req.body;
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Find the job
    const job = await Job.findById(id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (!canAccessJob(req, job)) {
      return res.status(403).json({ error: 'Not authorized to modify candidates for this job' });
    }
    
    // Check if valid candidates array was provided
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'Invalid candidates data' });
    }

    console.log(`Saving ${candidates.length} candidates for job ${id}`);
    
    // First, find all existing candidates to preserve tracking data
    const candidateFilenames = candidates
      .map(c => (c && typeof c.filename === 'string' ? c.filename : null))
      .filter((f): f is string => !!f);
    const existingCandidates = await JobCandidate.find({ 
      jobId: id, 
      filename: { $in: candidateFilenames } 
    });
    
    console.log(`Found ${existingCandidates.length} existing candidates with tracking data`);
    
    // Create a map of existing tracking data by filename
    const trackingDataMap = new Map();
    existingCandidates.forEach(candidate => {
      if (candidate.tracking) {
        trackingDataMap.set(candidate.filename, candidate.tracking);
      }
    });
    
    // Define a proper interface for the processed candidate to include the tracking property
    interface ProcessedCandidate {
      filename: string;
      name: string;
      email: string;
      matchAnalysis: IMatchAnalysis;
      analysis: {
        key_skills: string[];
        education_details: IEducation[];
        work_experience_details: IWorkExperience[];
      };
      jobId: mongoose.Types.ObjectId;
      userId: string;
      userEmail: string;
      tracking?: ITracking;
    }

    // Process candidates one by one instead of bulk write to better handle errors
    const processedCandidates = [];
    const errors = [];
    
    for (const candidate of candidates) {
      try {
        // Skip candidates without required fields
        if (!candidate || !candidate.filename || !candidate.matchAnalysis) {
          console.warn(`Skipping invalid candidate data: ${JSON.stringify(candidate)}`);
          continue;
        }
        
        // Ensure required fields exist
        const processedCandidate: ProcessedCandidate = {
          filename: candidate.filename,
          name: candidate.name || "Unknown",
          email: candidate.email || "unknown@example.com",
          matchAnalysis: {
            matchPercentage: candidate.matchAnalysis.matchPercentage || 0,
            matchingSkills: candidate.matchAnalysis.matchingSkills || [],
            missingRequirements: candidate.matchAnalysis.missingRequirements || [],
            experienceMatch: candidate.matchAnalysis.experienceMatch || false,
            educationMatch: candidate.matchAnalysis.educationMatch || false,
            overallAssessment: candidate.matchAnalysis.overallAssessment || ""
          },
          analysis: {
            key_skills: candidate.analysis?.key_skills || [],
            education_details: candidate.analysis?.education_details || [],
            work_experience_details: candidate.analysis?.work_experience_details || []
          },
          jobId: new mongoose.Types.ObjectId(id),
          userId: candidate.userId || userId,
          userEmail: candidate.userEmail || req.user?.email || "unknown@example.com"
        };
        
        // Add existing tracking data if it exists
        const existingTracking = trackingDataMap.get(candidate.filename);
        if (existingTracking) {
          processedCandidate.tracking = existingTracking;
        } else {
          processedCandidate.tracking = {
            status: 'pending',
            statusHistory: [{
              status: 'pending',
              timestamp: new Date(),
              updatedBy: req.user?.email || 'system'
            }],
            lastUpdated: new Date(),
            updatedBy: req.user?.email || 'system'
          };
        }
        
        // Try to find existing candidate
        const existingCandidate = await JobCandidate.findOne({
          jobId: id,
          filename: candidate.filename
        });
        
        if (existingCandidate) {
          // Update existing candidate
          await JobCandidate.updateOne(
            { _id: existingCandidate._id },
            { 
              $set: {
                ...processedCandidate,
                updated_at: new Date()
              }
            }
          );
        } else {
          // Create new candidate
          const newCandidate = new JobCandidate({
            ...processedCandidate,
            created_at: new Date(),
            updated_at: new Date()
          });
          
          await newCandidate.save();
        }
        
        processedCandidates.push(processedCandidate);
      } catch (err: unknown) {
        console.error(`Error processing candidate:`, err);
        errors.push({
          filename: candidate?.filename ?? 'unknown',
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
    
    res.status(200).json({
      message: 'Candidates saved successfully',
      savedCount: processedCandidates.length,
      totalCount: candidates.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: unknown) {
    console.error('Error saving job candidates:', error);
    res.status(500).json({
      error: 'Failed to save job candidates',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// Update candidate status
export const updateCandidateStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, candidateId } = req.params;
    const { status, ...additionalData } = req.body;
    
    // Authenticate user
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Find job and candidate
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (!canAccessJob(req, job)) {
      return res.status(403).json({ message: 'Not authorized to update candidates for this job' });
    }

    // Whitelist status so arbitrary strings can never enter the pipeline
    if (typeof status !== 'string' || !ALLOWED_CANDIDATE_STATUSES.has(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // Find the candidate by filename
    const candidate = await JobCandidate.findOne({ 
      jobId: id, 
      filename: candidateId 
    });

    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Initialize tracking if it doesn't exist
    if (!candidate.tracking) {
      candidate.tracking = {
        status: 'new',
        statusHistory: [],
        lastUpdated: new Date(),
        updatedBy: req.user?.email || 'system'
      };
    }

    // Update tracking info
    candidate.tracking.status = status;
    candidate.tracking.lastUpdated = new Date();
    candidate.tracking.updatedBy = req.user?.email || 'system';

    // Add status history entry
    if (!candidate.tracking.statusHistory) {
      candidate.tracking.statusHistory = [];
    }

    candidate.tracking.statusHistory.push({
      status,
      timestamp: new Date(),
      updatedBy: req.user?.email || 'system'
    });

    // Process additional data
    if (status === 'rate_confirmed' && additionalData.rateConfirmed) {
      candidate.tracking.rateConfirmed = additionalData.rateConfirmed;
    }

    if (status === 'interview_scheduled' && additionalData.interviewDate) {
      candidate.tracking.interviewDate = additionalData.interviewDate;
    }

    if (status === 'contacted' && additionalData.contactedDate) {
      candidate.tracking.contactedDate = additionalData.contactedDate;
    }

    if (additionalData.notes) {
      candidate.tracking.notes = additionalData.notes;
    }

    // Save updated candidate
    await candidate.save();

    // Return the updated candidate with tracking info
    res.status(200).json({ 
      message: 'Candidate status updated successfully',
      candidate: candidate.toObject(),
      tracking: candidate.tracking
    });
  } catch (error) {
    console.error('Error updating candidate status:', error);
    res.status(500).json({ message: 'Error updating candidate status', error: (error as Error).message });
  }
};

// Get all resumes for job matching
export const getAllResumesForMatching = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Admin-only endpoint (route-gated) — returns every resume for matching
    const allResumes = await Resume.find({});
    
    console.log(`Found ${allResumes.length} total resumes`);
    
    // Transform the resumes to the expected format
    const transformedResumes = allResumes.map(resume => {
      const user_id = resume.user_id || userId;
      
      return {
        filename: resume.filename,
        analysis: resume.analysis || {
          name: "Unknown",
          email: "unknown@example.com",
          key_skills: [],
          education_details: [],
          work_experience_details: []
        },
        userId: user_id,
        userEmail: resume.user_email || "unknown@example.com"
      };
    });
    
    res.status(200).json(transformedResumes);
  } catch (error) {
    console.error('Error fetching all resumes:', error);
    res.status(500).json({ error: 'Failed to fetch all resumes' });
  }
};

// Assign recruiters to a job
export const assignRecruiters = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { recruiterIds } = req.body;
    const userId = req.user?.uid;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Find the job
    const job = await Job.findById(id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Check if user is admin or the creator of the job
    const isAdmin = userRole === 'admin';
    const isCreator = job.metadata?.created_by_id === userId;
    
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Not authorized to assign recruiters to this job' });
    }
    
    // Update job with assigned recruiters (validated: plain uid strings only)
    if (!Array.isArray(recruiterIds) || recruiterIds.some((r: unknown) => typeof r !== 'string')) {
      return res.status(400).json({ error: 'Invalid recruiterIds' });
    }
    const updatedJob = await Job.findByIdAndUpdate(
      id, 
      { assigned_recruiters: recruiterIds }, 
      { new: true, runValidators: true }
    );
    
    res.status(200).json(updatedJob);
  } catch (error) {
    console.error('Error assigning recruiters:', error);
    res.status(500).json({ error: 'Failed to assign recruiters' });
  }
};

// Download a candidate's resume file for a job the caller may access.
// Candidates only store the filename, so the actual file is resolved through
// the Resume record with the same filename.
export const getCandidateFile = async (req: AuthRequest, res: Response) => {
  try {
    const { id, filename } = req.params;
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (!canAccessJob(req, job)) {
      return res.status(403).json({ error: 'Not authorized to access candidates for this job' });
    }

    const candidate = await JobCandidate.findOne({ jobId: id, filename });
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const resume = await Resume.findOne({ filename });
    if (!resume) {
      return res.status(404).json({ error: 'Resume file not found' });
    }

    return streamResumeToClient(res, resume, true);
  } catch (error) {
    console.error('Error fetching candidate file:', error);
    return res.status(500).json({ error: 'Failed to fetch candidate file' });
  }
};

// Run AI match analysis for a small batch of resumes against a job.
// Gemini is called server-side only — the API key never reaches the browser.
export const analyzeMatches = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { job, resumes } = req.body || {};
    if (!job || typeof job !== 'object' || !Array.isArray(resumes) || resumes.length === 0) {
      return res.status(400).json({ error: 'Missing job or resumes' });
    }
    if (resumes.length > 10) {
      return res.status(400).json({ error: 'Too many resumes per request (max 10)' });
    }

    const results = await analyzeBatchMatches(job, resumes);
    res.status(200).json(results);
  } catch (error) {
    console.error('Error in match analysis:', error);
    res.status(500).json({ error: 'Failed to analyze matches' });
  }
};

// Check for new resumes since last analysis
export const checkForNewResumes = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // Job ID
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Find the job to ensure it exists
    const job = await Job.findById(id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (!canAccessJob(req, job)) {
      return res.status(403).json({ error: 'Not authorized to view this job' });
    }
    
    // Get all analyzed candidates for this job
    const analyzedCandidates = await JobCandidate.find({ jobId: id });
    const analyzedFilenames = analyzedCandidates.map(c => c.filename);
    
    // Get all available resumes
    const allResumes = await Resume.find({});
    const allFilenames = allResumes.map(r => r.filename);
    
    // Find filenames that are in allResumes but not in analyzedCandidates
    const newFilenames = allFilenames.filter(filename => !analyzedFilenames.includes(filename));
    
    res.status(200).json({ 
      hasNewResumes: newFilenames.length > 0,
      newResumeCount: newFilenames.length,
      analyzedCount: analyzedFilenames.length,
      totalResumeCount: allFilenames.length
    });
    
  } catch (error) {
    console.error('Error checking for new resumes:', error);
    res.status(500).json({ error: 'Failed to check for new resumes' });
  }
};