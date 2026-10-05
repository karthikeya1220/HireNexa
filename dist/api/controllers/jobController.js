"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkForNewResumes = exports.analyzeMatches = exports.getCandidateFile = exports.assignRecruiters = exports.getAllResumesForMatching = exports.updateCandidateStatus = exports.saveJobCandidates = exports.getJobCandidates = exports.deleteJob = exports.updateJob = exports.createJob = exports.getJobById = exports.getAllJobs = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Job_1 = __importDefault(require("../models/Job"));
const JobCandidate_1 = __importDefault(require("../models/JobCandidate"));
const Resume_1 = __importDefault(require("../models/Resume"));
const auth_helpers_1 = require("../utils/auth-helpers");
const gemini_1 = require("../utils/gemini");
const resumeController_1 = require("./resumeController");
// Allowed candidate pipeline statuses (mirrors the frontend CandidateStatus
// union plus the board's 'matched'/'new' placeholders).
const ALLOWED_CANDIDATE_STATUSES = new Set([
    'pending', 'new', 'matched', 'shortlisted', 'contacted', 'interested',
    'not_interested', 'rate_confirmed', 'interview_scheduled', 'approved', 'disapproved'
]);
// Job access: admins, the job creator, or recruiters assigned to the job.
// Used by every candidate read/write endpoint (previously any authenticated
// user could read/overwrite any job's pipeline).
const canAccessJob = (req, job) => {
    var _a, _b, _c, _d;
    if ((0, auth_helpers_1.isAdminUser)((_a = req.user) === null || _a === void 0 ? void 0 : _a.role))
        return true;
    if (((_b = job === null || job === void 0 ? void 0 : job.metadata) === null || _b === void 0 ? void 0 : _b.created_by_id) && job.metadata.created_by_id === ((_c = req.user) === null || _c === void 0 ? void 0 : _c.uid))
        return true;
    const uid = (_d = req.user) === null || _d === void 0 ? void 0 : _d.uid;
    return !!uid && Array.isArray(job === null || job === void 0 ? void 0 : job.assigned_recruiters) && job.assigned_recruiters.includes(uid);
};
// Get all jobs
const getAllJobs = async (req, res) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
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
        const query = (0, auth_helpers_1.isAdminUser)((_b = req.user) === null || _b === void 0 ? void 0 : _b.role)
            ? { ...statusFilter }
            : {
                $or: [
                    { 'metadata.created_by_id': userId },
                    { assigned_recruiters: userId },
                ],
                ...statusFilter,
            };
        // Find all jobs
        const jobs = await Job_1.default.find(query).sort({ created_at: -1 });
        res.status(200).json(jobs);
    }
    catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
};
exports.getAllJobs = getAllJobs;
// Get job by ID
const getJobById = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const job = await Job_1.default.findById(id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.status(200).json(job);
    }
    catch (error) {
        console.error('Error fetching job:', error);
        res.status(500).json({ error: 'Failed to fetch job' });
    }
};
exports.getJobById = getJobById;
// Create a new job
const createJob = async (req, res) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const userEmail = (_b = req.user) === null || _b === void 0 ? void 0 : _b.email;
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
        const job = new Job_1.default(jobData);
        await job.save();
        res.status(201).json(job);
    }
    catch (error) {
        console.error('Error creating job:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
};
exports.createJob = createJob;
// Update an existing job
const updateJob = async (req, res) => {
    var _a, _b, _c, _d;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const userEmail = (_b = req.user) === null || _b === void 0 ? void 0 : _b.email;
        const userRole = (_c = req.user) === null || _c === void 0 ? void 0 : _c.role;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const job = await Job_1.default.findById(id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        // Check if user can modify this job
        const isAuthorized = (0, auth_helpers_1.isAdminUser)(userRole) || (0, auth_helpers_1.canModifyResource)(userId, (_d = job.metadata) === null || _d === void 0 ? void 0 : _d.created_by_id);
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
        const updatedJob = await Job_1.default.findByIdAndUpdate(id, updatedJobData, { new: true, runValidators: true });
        res.status(200).json(updatedJob);
    }
    catch (error) {
        console.error('Error updating job:', error);
        res.status(500).json({ error: 'Failed to update job' });
    }
};
exports.updateJob = updateJob;
// Delete a job
const deleteJob = async (req, res) => {
    var _a, _b, _c;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const userRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const job = await Job_1.default.findById(id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        // Check if user can delete this job
        const isAuthorized = (0, auth_helpers_1.isAdminUser)(userRole) || (0, auth_helpers_1.canModifyResource)(userId, (_c = job.metadata) === null || _c === void 0 ? void 0 : _c.created_by_id);
        if (!isAuthorized) {
            return res.status(403).json({ error: 'Not authorized to delete this job' });
        }
        // Delete job
        await Job_1.default.findByIdAndDelete(id);
        // Also delete any associated candidates
        await JobCandidate_1.default.deleteMany({ jobId: id });
        res.status(200).json({ message: 'Job deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting job:', error);
        res.status(500).json({ error: 'Failed to delete job' });
    }
};
exports.deleteJob = deleteJob;
// Get job candidates
const getJobCandidates = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Find the job to ensure it exists
        const job = await Job_1.default.findById(id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (!canAccessJob(req, job)) {
            return res.status(403).json({ error: 'Not authorized to view candidates for this job' });
        }
        // Find candidates from the JobCandidate collection
        const candidates = await JobCandidate_1.default.find({ jobId: id }).sort({ 'matchAnalysis.matchPercentage': -1 });
        res.status(200).json(candidates);
    }
    catch (error) {
        console.error('Error fetching job candidates:', error);
        res.status(500).json({ error: 'Failed to fetch job candidates' });
    }
};
exports.getJobCandidates = getJobCandidates;
// Save a list of analyzed candidate matches to the database
const saveJobCandidates = async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const { id } = req.params;
        const { candidates } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Find the job
        const job = await Job_1.default.findById(id);
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
            .filter((f) => !!f);
        const existingCandidates = await JobCandidate_1.default.find({
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
                const processedCandidate = {
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
                        key_skills: ((_b = candidate.analysis) === null || _b === void 0 ? void 0 : _b.key_skills) || [],
                        education_details: ((_c = candidate.analysis) === null || _c === void 0 ? void 0 : _c.education_details) || [],
                        work_experience_details: ((_d = candidate.analysis) === null || _d === void 0 ? void 0 : _d.work_experience_details) || []
                    },
                    jobId: new mongoose_1.default.Types.ObjectId(id),
                    userId: candidate.userId || userId,
                    userEmail: candidate.userEmail || ((_e = req.user) === null || _e === void 0 ? void 0 : _e.email) || "unknown@example.com"
                };
                // Add existing tracking data if it exists
                const existingTracking = trackingDataMap.get(candidate.filename);
                if (existingTracking) {
                    processedCandidate.tracking = existingTracking;
                }
                else {
                    processedCandidate.tracking = {
                        status: 'pending',
                        statusHistory: [{
                                status: 'pending',
                                timestamp: new Date(),
                                updatedBy: ((_f = req.user) === null || _f === void 0 ? void 0 : _f.email) || 'system'
                            }],
                        lastUpdated: new Date(),
                        updatedBy: ((_g = req.user) === null || _g === void 0 ? void 0 : _g.email) || 'system'
                    };
                }
                // Try to find existing candidate
                const existingCandidate = await JobCandidate_1.default.findOne({
                    jobId: id,
                    filename: candidate.filename
                });
                if (existingCandidate) {
                    // Update existing candidate
                    await JobCandidate_1.default.updateOne({ _id: existingCandidate._id }, {
                        $set: {
                            ...processedCandidate,
                            updated_at: new Date()
                        }
                    });
                }
                else {
                    // Create new candidate
                    const newCandidate = new JobCandidate_1.default({
                        ...processedCandidate,
                        created_at: new Date(),
                        updated_at: new Date()
                    });
                    await newCandidate.save();
                }
                processedCandidates.push(processedCandidate);
            }
            catch (err) {
                console.error(`Error processing candidate:`, err);
                errors.push({
                    filename: (_h = candidate === null || candidate === void 0 ? void 0 : candidate.filename) !== null && _h !== void 0 ? _h : 'unknown',
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
    }
    catch (error) {
        console.error('Error saving job candidates:', error);
        res.status(500).json({
            error: 'Failed to save job candidates',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};
exports.saveJobCandidates = saveJobCandidates;
// Update candidate status
const updateCandidateStatus = async (req, res) => {
    var _a, _b, _c, _d;
    try {
        const { id, candidateId } = req.params;
        const { status, ...additionalData } = req.body;
        // Authenticate user
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        // Find job and candidate
        const job = await Job_1.default.findById(id);
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
        const candidate = await JobCandidate_1.default.findOne({
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
                updatedBy: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.email) || 'system'
            };
        }
        // Update tracking info
        candidate.tracking.status = status;
        candidate.tracking.lastUpdated = new Date();
        candidate.tracking.updatedBy = ((_c = req.user) === null || _c === void 0 ? void 0 : _c.email) || 'system';
        // Add status history entry
        if (!candidate.tracking.statusHistory) {
            candidate.tracking.statusHistory = [];
        }
        candidate.tracking.statusHistory.push({
            status,
            timestamp: new Date(),
            updatedBy: ((_d = req.user) === null || _d === void 0 ? void 0 : _d.email) || 'system'
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
    }
    catch (error) {
        console.error('Error updating candidate status:', error);
        res.status(500).json({ message: 'Error updating candidate status', error: error.message });
    }
};
exports.updateCandidateStatus = updateCandidateStatus;
// Get all resumes for job matching
const getAllResumesForMatching = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Admin-only endpoint (route-gated) — returns every resume for matching
        const allResumes = await Resume_1.default.find({});
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
    }
    catch (error) {
        console.error('Error fetching all resumes:', error);
        res.status(500).json({ error: 'Failed to fetch all resumes' });
    }
};
exports.getAllResumesForMatching = getAllResumesForMatching;
// Assign recruiters to a job
const assignRecruiters = async (req, res) => {
    var _a, _b, _c;
    try {
        const { id } = req.params;
        const { recruiterIds } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const userRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Find the job
        const job = await Job_1.default.findById(id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        // Check if user is admin or the creator of the job
        const isAdmin = userRole === 'admin';
        const isCreator = ((_c = job.metadata) === null || _c === void 0 ? void 0 : _c.created_by_id) === userId;
        if (!isAdmin && !isCreator) {
            return res.status(403).json({ error: 'Not authorized to assign recruiters to this job' });
        }
        // Update job with assigned recruiters (validated: plain uid strings only)
        if (!Array.isArray(recruiterIds) || recruiterIds.some((r) => typeof r !== 'string')) {
            return res.status(400).json({ error: 'Invalid recruiterIds' });
        }
        const updatedJob = await Job_1.default.findByIdAndUpdate(id, { assigned_recruiters: recruiterIds }, { new: true, runValidators: true });
        res.status(200).json(updatedJob);
    }
    catch (error) {
        console.error('Error assigning recruiters:', error);
        res.status(500).json({ error: 'Failed to assign recruiters' });
    }
};
exports.assignRecruiters = assignRecruiters;
// Download a candidate's resume file for a job the caller may access.
// Candidates only store the filename, so the actual file is resolved through
// the Resume record with the same filename.
const getCandidateFile = async (req, res) => {
    var _a;
    try {
        const { id, filename } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const job = await Job_1.default.findById(id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (!canAccessJob(req, job)) {
            return res.status(403).json({ error: 'Not authorized to access candidates for this job' });
        }
        const candidate = await JobCandidate_1.default.findOne({ jobId: id, filename });
        if (!candidate) {
            return res.status(404).json({ error: 'Candidate not found' });
        }
        const resume = await Resume_1.default.findOne({ filename });
        if (!resume) {
            return res.status(404).json({ error: 'Resume file not found' });
        }
        return (0, resumeController_1.streamResumeToClient)(res, resume, true);
    }
    catch (error) {
        console.error('Error fetching candidate file:', error);
        return res.status(500).json({ error: 'Failed to fetch candidate file' });
    }
};
exports.getCandidateFile = getCandidateFile;
// Run AI match analysis for a small batch of resumes against a job.
// Gemini is called server-side only — the API key never reaches the browser.
const analyzeMatches = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
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
        const results = await (0, gemini_1.analyzeBatchMatches)(job, resumes);
        res.status(200).json(results);
    }
    catch (error) {
        console.error('Error in match analysis:', error);
        res.status(500).json({ error: 'Failed to analyze matches' });
    }
};
exports.analyzeMatches = analyzeMatches;
// Check for new resumes since last analysis
const checkForNewResumes = async (req, res) => {
    var _a;
    try {
        const { id } = req.params; // Job ID
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Find the job to ensure it exists
        const job = await Job_1.default.findById(id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (!canAccessJob(req, job)) {
            return res.status(403).json({ error: 'Not authorized to view this job' });
        }
        // Get all analyzed candidates for this job
        const analyzedCandidates = await JobCandidate_1.default.find({ jobId: id });
        const analyzedFilenames = analyzedCandidates.map(c => c.filename);
        // Get all available resumes
        const allResumes = await Resume_1.default.find({});
        const allFilenames = allResumes.map(r => r.filename);
        // Find filenames that are in allResumes but not in analyzedCandidates
        const newFilenames = allFilenames.filter(filename => !analyzedFilenames.includes(filename));
        res.status(200).json({
            hasNewResumes: newFilenames.length > 0,
            newResumeCount: newFilenames.length,
            analyzedCount: analyzedFilenames.length,
            totalResumeCount: allFilenames.length
        });
    }
    catch (error) {
        console.error('Error checking for new resumes:', error);
        res.status(500).json({ error: 'Failed to check for new resumes' });
    }
};
exports.checkForNewResumes = checkForNewResumes;
