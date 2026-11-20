"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicJobDetails = exports.submitPublicCandidate = void 0;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../db");
const gemini_1 = require("../utils/gemini");
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'resumes';
// Public candidate submission (for careers page / vendor link)
const submitPublicCandidate = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { file, candidateName, candidateEmail, vendorName } = req.body || {};
        if (!(0, db_1.isUuid)(jobId)) {
            return res.status(400).json({ error: 'Invalid Job ID' });
        }
        if (!file || typeof file.data !== 'string' || !file.name) {
            return res.status(400).json({ error: 'Missing resume file data' });
        }
        // Verify job exists and is active
        const { data: job, error: jobErr } = await db_1.supabaseAdmin
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
        const fileHash = crypto_1.default.createHash('sha256').update(fileBuffer).digest('hex');
        const safeFilename = `${crypto_1.default.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        // 1. Analyze resume with Gemini
        const analysis = await (0, gemini_1.analyzeResumeBuffer)(fileBuffer, file.type || 'application/pdf');
        // 2. Upload file to Supabase Storage
        const storagePath = `public_submissions/${jobId}/${safeFilename}`;
        const { error: uploadError } = await db_1.supabaseAdmin.storage
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
        const { data: inserted, error: insertErr } = await db_1.supabaseAdmin
            .from('job_candidates')
            .insert(candidateData)
            .select('*')
            .single();
        if (insertErr) {
            throw insertErr;
        }
        // Increment application count on the job
        try {
            await db_1.supabaseAdmin.rpc('increment_job_applications', { job_id_param: jobId });
        }
        catch {
            // Best-effort counter increment fallback
        }
        res.status(201).json({
            message: 'Application submitted successfully',
            candidateId: inserted.id,
            name: candidateData.name,
        });
    }
    catch (error) {
        console.error('Error submitting public candidate:', error);
        res.status(500).json({ error: error.message || 'Failed to submit application' });
    }
};
exports.submitPublicCandidate = submitPublicCandidate;
// Get public job details (no auth required)
const getPublicJobDetails = async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!(0, db_1.isUuid)(jobId)) {
            return res.status(400).json({ error: 'Invalid Job ID' });
        }
        const { data: job, error } = await db_1.supabaseAdmin
            .from('jobs')
            .select('id, title, company, location, employment_type, salary_range, description, requirements, benefits, skills_required, mode_of_work, created_at')
            .eq('id', jobId)
            .eq('status', 'active')
            .single();
        if (error || !job) {
            return res.status(404).json({ error: 'Job opening not found or inactive' });
        }
        res.status(200).json(job);
    }
    catch (error) {
        console.error('Error fetching public job:', error);
        res.status(500).json({ error: 'Failed to fetch job details' });
    }
};
exports.getPublicJobDetails = getPublicJobDetails;
