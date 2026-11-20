import { Request, Response } from 'express';
import crypto from 'crypto';
import { supabaseAdmin, isUuid } from '../db';
import { analyzeResumeBuffer, type ResumeAnalysis } from '../utils/gemini';

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'resumes';

// Public candidate submission (for careers page / vendor link)
export const submitPublicCandidate = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { file, candidateName, candidateEmail, vendorName } = req.body || {};

    if (!isUuid(jobId)) {
      return res.status(400).json({ error: 'Invalid Job ID' });
    }

    if (!file || typeof file.data !== 'string' || !file.name) {
      return res.status(400).json({ error: 'Missing resume file data' });
    }

    // Verify job exists and is active
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('jobs')
      .select('id, title, status')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return res.status(404).json({ error: 'Job opening not found' });
    }

    if (job.status !== 'active') {
      return res.status(400).json({ error: 'This job opening is no longer accepting submissions' });
    }

    const fileBuffer = Buffer.from(file.data, 'base64');
    if (fileBuffer.length === 0) {
      return res.status(400).json({ error: 'Empty file' });
    }

    // Hash check for duplicates within this job
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const safeFilename = `${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // 1. Analyze resume with Gemini
    const analysis: ResumeAnalysis = await analyzeResumeBuffer(fileBuffer, file.type || 'application/pdf');

    // 2. Upload file to Supabase Storage
    const storagePath = `public_submissions/${jobId}/${safeFilename}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    // 3. Insert into job_candidates
    const candidateData = {
      job_id: jobId,
      filename: safeFilename,
      name: candidateName || analysis.name || analysis.Name || 'Candidate',
      email: candidateEmail || analysis.email || '',
      match_analysis: {
        matchPercentage: 0,
        matchingSkills: [],
        missingRequirements: [],
        experienceMatch: false,
        educationMatch: false,
        overallAssessment: 'Awaiting recruiter triage.',
      },
      analysis,
      tracking: {
        status: 'pending',
        appliedDate: new Date().toISOString(),
        source: vendorName ? `Vendor: ${vendorName}` : 'Public Portal',
        fileHash,
        storagePath,
      },
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('job_candidates')
      .insert(candidateData)
      .select('*')
      .single();

    if (insertErr) {
      throw insertErr;
    }

    // Increment application count on the job
    try {
      await supabaseAdmin.rpc('increment_job_applications', { job_id_param: jobId });
    } catch {
      // Best-effort counter increment fallback
    }

    res.status(201).json({
      message: 'Application submitted successfully',
      candidateId: inserted.id,
      name: candidateData.name,
    });
  } catch (error: any) {
    console.error('Error submitting public candidate:', error);
    res.status(500).json({ error: error.message || 'Failed to submit application' });
  }
};

// Get public job details (no auth required)
export const getPublicJobDetails = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    if (!isUuid(jobId)) {
      return res.status(400).json({ error: 'Invalid Job ID' });
    }

    const { data: job, error } = await supabaseAdmin
      .from('jobs')
      .select('id, title, company, location, employment_type, salary_range, description, requirements, benefits, skills_required, mode_of_work, created_at')
      .eq('id', jobId)
      .eq('status', 'active')
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job opening not found or inactive' });
    }

    res.status(200).json(job);
  } catch (error: any) {
    console.error('Error fetching public job:', error);
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
};
