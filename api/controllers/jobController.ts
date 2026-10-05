import { Request, Response } from 'express';
import { supabaseAdmin, isUuid, httpStatusForDbError } from '../db';
import { type IJob, type JobRow, toJob } from '../models/Job';
import {
  type IEducation,
  type IMatchAnalysis,
  type ITracking,
  type IWorkExperience,
  type JobCandidateRow,
  toCandidate,
} from '../models/JobCandidate';
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

// Columns the client may write on jobs (everything else is server-owned).
const JOB_WRITABLE_COLUMNS = [
  'title', 'company', 'location', 'description', 'employment_type',
  'experience_required', 'salary_range', 'status', 'requirements', 'benefits',
  'skills_required', 'nice_to_have_skills', 'working_hours', 'mode_of_work',
  'deadline', 'key_responsibilities', 'about_company', 'total_applications',
  'shortlisted', 'rejected', 'in_progress', 'assigned_recruiters', 'candidates',
] as const;

const pickJobFields = (body: Record<string, unknown> | undefined): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of JOB_WRITABLE_COLUMNS) {
    if (body && key in body) out[key] = body[key];
  }
  return out;
};

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

// Fetch one job by id (returns null for missing or malformed ids — Postgres
// rejects non-uuid params before they hit the table).
const findJobById = async (id: string): Promise<IJob | null> => {
  if (!isUuid(id)) return null;
  const { data, error } = await supabaseAdmin.from('jobs').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toJob(data as JobRow) : null;
};

// Get all jobs
export const getAllJobs = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get query parameters — must be a plain string.
    const rawStatus = req.query.status;
    const status = typeof rawStatus === 'string' ? rawStatus : undefined;

    // Admins see every job; everyone else only sees jobs they created or
    // were assigned to (same boundary as candidate access).
    let query = supabaseAdmin.from('jobs').select('*');
    if (!isAdminUser(req.user?.role)) {
      query = query.or(
        `metadata->>created_by_id.eq.${userId},assigned_recruiters.cs.{${userId}}`
      );
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    res.status(200).json((data ?? []).map((row) => toJob(row as JobRow)));
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

    const job = await findJobById(id);

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

    // Create new job with metadata — never let the client set identity fields
    const jobData = {
      ...pickJobFields(req.body),
      metadata: {
        created_by: userEmail,
        created_by_id: userId,
        last_modified_by: userEmail,
      },
    };

    const { data: job, error } = await supabaseAdmin
      .from('jobs')
      .insert(jobData)
      .select('*')
      .single();
    if (error) throw error;

    res.status(201).json(toJob(job as JobRow));
  } catch (error) {
    console.error('Error creating job:', error);
    if (httpStatusForDbError(error) === 400) {
      return res.status(400).json({ error: 'Invalid job data' });
    }
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

    const job = await findJobById(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if user can modify this job
    const isAuthorized = isAdminUser(userRole) || canModifyResource(userId, job.metadata?.created_by_id);

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized to update this job' });
    }

    // Update job data — identity/ownership fields are server-owned; ownership
    // metadata is merged (never replaced) like the old dotted-path update.
    const updatedJobData = {
      ...pickJobFields(req.body),
      metadata: {
        ...(job.metadata ?? {}),
        last_modified_by: userEmail,
      },
    };

    const { data: updatedJob, error } = await supabaseAdmin
      .from('jobs')
      .update(updatedJobData)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!updatedJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.status(200).json(toJob(updatedJob as JobRow));
  } catch (error) {
    console.error('Error updating job:', error);
    if (httpStatusForDbError(error) === 400) {
      return res.status(400).json({ error: 'Invalid job data' });
    }
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

    const job = await findJobById(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if user can delete this job
    const isAuthorized = isAdminUser(userRole) || canModifyResource(userId, job.metadata?.created_by_id);

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized to delete this job' });
    }

    // Delete job — associated candidates go with it (ON DELETE CASCADE)
    const { error } = await supabaseAdmin.from('jobs').delete().eq('id', id);
    if (error) throw error;

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

    const job = await findJobById(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!canAccessJob(req, job)) {
      return res.status(403).json({ error: 'Not authorized to view candidates for this job' });
    }

    const { data, error } = await supabaseAdmin
      .from('job_candidates')
      .select('*')
      .eq('job_id', id);
    if (error) throw error;

    // Sort by match percentage (desc), same order the Mongo sort produced
    const candidates = (data ?? [])
      .map((row) => row as JobCandidateRow)
      .sort(
        (a, b) =>
          (b.match_analysis?.matchPercentage ?? -1) - (a.match_analysis?.matchPercentage ?? -1)
      )
      .map(toCandidate);

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

    const job = await findJobById(id);

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
      .map((c) => (c && typeof c.filename === 'string' ? c.filename : null))
      .filter((f): f is string => !!f);

    const trackingDataMap = new Map<string, ITracking>();
    if (candidateFilenames.length > 0) {
      const { data: existingCandidates, error: existingError } = await supabaseAdmin
        .from('job_candidates')
        .select('filename, tracking')
        .eq('job_id', id)
        .in('filename', candidateFilenames);
      if (existingError) throw existingError;
      (existingCandidates ?? []).forEach((row) => {
        if (row.tracking) {
          trackingDataMap.set(row.filename, row.tracking as ITracking);
        }
      });
    }

    console.log(`Found ${trackingDataMap.size} existing candidates with tracking data`);

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
        const matchAnalysis: IMatchAnalysis = {
          matchPercentage: candidate.matchAnalysis.matchPercentage || 0,
          matchingSkills: candidate.matchAnalysis.matchingSkills || [],
          missingRequirements: candidate.matchAnalysis.missingRequirements || [],
          experienceMatch: candidate.matchAnalysis.experienceMatch || false,
          educationMatch: candidate.matchAnalysis.educationMatch || false,
          overallAssessment: candidate.matchAnalysis.overallAssessment || ""
        };
        const analysis = {
          key_skills: candidate.analysis?.key_skills || [],
          education_details: candidate.analysis?.education_details || ([] as IEducation[]),
          work_experience_details: candidate.analysis?.work_experience_details || ([] as IWorkExperience[])
        };

        const existingTracking = trackingDataMap.get(candidate.filename);
        const tracking: ITracking = existingTracking ?? {
          status: 'pending',
          statusHistory: [{
            status: 'pending',
            timestamp: new Date(),
            updatedBy: req.user?.email || 'system'
          }],
          lastUpdated: new Date(),
          updatedBy: req.user?.email || 'system'
        };

        // Upsert on (job_id, filename): preserves tracking, refreshes analysis
        const row = {
          job_id: id,
          filename: candidate.filename,
          name: candidate.name || "Unknown",
          email: candidate.email || "unknown@example.com",
          match_analysis: matchAnalysis,
          analysis,
          tracking,
          user_id: candidate.userId || userId,
          user_email: candidate.userEmail || req.user?.email || "unknown@example.com",
        };
        const { error: upsertError } = await supabaseAdmin
          .from('job_candidates')
          .upsert(row, { onConflict: 'job_id,filename' });
        if (upsertError) throw upsertError;

        processedCandidates.push(row);
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
    const job = await findJobById(id);
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
    const { data: candidateRow, error: candidateError } = await supabaseAdmin
      .from('job_candidates')
      .select('*')
      .eq('job_id', id)
      .eq('filename', candidateId)
      .maybeSingle();
    if (candidateError) throw candidateError;

    if (!candidateRow) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    const candidate = candidateRow as JobCandidateRow;

    // Initialize tracking if it doesn't exist
    const tracking: ITracking = candidate.tracking ?? {
      status: 'new',
      statusHistory: [],
      lastUpdated: new Date(),
      updatedBy: req.user?.email || 'system'
    };

    // Update tracking info
    tracking.status = status;
    tracking.lastUpdated = new Date().toISOString();
    tracking.updatedBy = req.user?.email || 'system';

    // Add status history entry
    if (!tracking.statusHistory) {
      tracking.statusHistory = [];
    }

    tracking.statusHistory.push({
      status,
      timestamp: new Date(),
      updatedBy: req.user?.email || 'system'
    });

    // Process additional data
    if (status === 'rate_confirmed' && additionalData.rateConfirmed) {
      tracking.rateConfirmed = additionalData.rateConfirmed;
    }

    if (status === 'interview_scheduled' && additionalData.interviewDate) {
      tracking.interviewDate = additionalData.interviewDate;
    }

    if (status === 'contacted' && additionalData.contactedDate) {
      tracking.contactedDate = additionalData.contactedDate;
    }

    if (additionalData.notes) {
      tracking.notes = additionalData.notes;
    }

    // Save updated candidate
    const { data: updatedRow, error: updateError } = await supabaseAdmin
      .from('job_candidates')
      .update({ tracking })
      .eq('id', candidate.id)
      .select('*')
      .single();
    if (updateError) throw updateError;

    const updated = updatedRow as JobCandidateRow;

    // Return the updated candidate with tracking info
    res.status(200).json({
      message: 'Candidate status updated successfully',
      candidate: toCandidate(updated),
      tracking: updated.tracking
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
    const { data: allResumes, error } = await supabaseAdmin.from('resumes').select('*');
    if (error) throw error;

    console.log(`Found ${allResumes?.length ?? 0} total resumes`);

    // Transform the resumes to the expected format
    const transformedResumes = (allResumes ?? []).map((resume) => {
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
        userEmail: "unknown@example.com"
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
    const job = await findJobById(id);

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
    const { data: updatedJob, error } = await supabaseAdmin
      .from('jobs')
      .update({ assigned_recruiters: recruiterIds })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!updatedJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.status(200).json(toJob(updatedJob as JobRow));
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

    const job = await findJobById(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (!canAccessJob(req, job)) {
      return res.status(403).json({ error: 'Not authorized to access candidates for this job' });
    }

    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('job_candidates')
      .select('id')
      .eq('job_id', id)
      .eq('filename', filename)
      .maybeSingle();
    if (candidateError) throw candidateError;
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const { data: resume, error: resumeError } = await supabaseAdmin
      .from('resumes')
      .select('user_id, filename')
      .eq('filename', filename)
      .maybeSingle();
    if (resumeError) throw resumeError;
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
    const job = await findJobById(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!canAccessJob(req, job)) {
      return res.status(403).json({ error: 'Not authorized to view this job' });
    }

    // Get all analyzed candidates for this job
    const { data: analyzedCandidates, error: candidatesError } = await supabaseAdmin
      .from('job_candidates')
      .select('filename')
      .eq('job_id', id);
    if (candidatesError) throw candidatesError;
    const analyzedFilenames = (analyzedCandidates ?? []).map((c) => c.filename);

    // Get all available resumes
    const { data: allResumes, error: resumesError } = await supabaseAdmin
      .from('resumes')
      .select('filename');
    if (resumesError) throw resumesError;
    const allFilenames = (allResumes ?? []).map((r) => r.filename);

    // Find filenames that are in allResumes but not in analyzedCandidates
    const newFilenames = allFilenames.filter((filename) => !analyzedFilenames.includes(filename));

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
