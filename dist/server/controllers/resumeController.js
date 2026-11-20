"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addFeedback = exports.getFeedback = exports.getAllResumes = exports.deleteResume = exports.getResumeById = exports.getUserResumes = exports.saveResume = exports.checkDuplicateResume = exports.getResumeDownload = exports.getResumeContent = exports.streamResumeToClient = exports.analyzeAndUpload = void 0;
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const db_1 = require("../db");
const Resume_1 = require("../models/Resume");
const uuid_1 = require("uuid");
const gemini_1 = require("../utils/gemini");
// Supabase Storage bucket holding resume files (server-side only — the
// browser never talks to storage directly; every access flows through this API).
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'resumes';
// Ensure a users row exists (best-effort, same tolerance as before).
const ensureUserRecord = async (uid, email) => {
    const { data: existing, error: findError } = await db_1.supabaseAdmin
        .from('users')
        .select('uid')
        .eq('uid', uid)
        .maybeSingle();
    if (findError) {
        console.error('Error looking up user record:', findError);
        return;
    }
    if (existing)
        return;
    try {
        const { error } = await db_1.supabaseAdmin
            .from('users')
            .insert({ uid, email, role: 'user' });
        if (error)
            throw error;
    }
    catch (createError) {
        console.error('Error creating user record:', createError);
        // Continue even if user creation fails
    }
};
const findResumeByIdForUser = async (id, userId) => {
    var _a;
    if (!(0, db_1.isUuid)(id))
        return null;
    const { data, error } = await db_1.supabaseAdmin
        .from('resumes')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();
    if (error)
        throw error;
    return (_a = data) !== null && _a !== void 0 ? _a : null;
};
// Full resume pipeline, server-side: hash -> duplicate check -> AI analysis
// -> Supabase Storage upload -> signed URL -> save. Replaces the old client-side flow that
// shipped the AWS secret key and Gemini API key to the browser.
const analyzeAndUpload = async (req, res) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { file, vendor_id, vendor_name } = req.body || {};
        if (!file || typeof file.data !== 'string' || !file.name || !file.type) {
            return res.status(400).json({ error: 'Missing file data' });
        }
        const fileBuffer = Buffer.from(file.data, 'base64');
        if (fileBuffer.length === 0) {
            return res.status(400).json({ error: 'Empty file' });
        }
        // Generate file hash for duplicate checking
        const fileHash = crypto_1.default.createHash('sha256').update(fileBuffer).digest('hex');
        const { data: existingResume, error: dupError } = await db_1.supabaseAdmin
            .from('resumes')
            .select('id')
            .eq('user_id', userId)
            .eq('file_hash', fileHash)
            .limit(1);
        if (dupError)
            throw dupError;
        if (existingResume && existingResume.length > 0) {
            return res.status(409).json({ error: 'This resume has already been uploaded' });
        }
        // Analyze with Gemini (throws with a user-facing message on failure)
        let analysisJson;
        try {
            analysisJson = await (0, gemini_1.analyzeResumeBuffer)(fileBuffer, file.type);
        }
        catch (analysisError) {
            const message = analysisError.message;
            const status = message === 'Failed to analyze resume with AI model' ||
                message === 'Invalid JSON response from AI model'
                ? 502
                : 422;
            return res.status(status).json({ error: message });
        }
        // Generate unique filename (strip any path components from the client name)
        const safeName = path_1.default.basename(file.name).replace(/[/\\]/g, '_');
        const uniqueFilename = `${(0, uuid_1.v4)()}_${safeName}`;
        // Upload the file to Supabase Storage (service-role, server-side only)
        const storagePath = `resumes/${userId}/${uniqueFilename}`;
        const { error: uploadError } = await db_1.supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });
        if (uploadError)
            throw uploadError;
        // Generate a signed URL (valid for 1 hour — primary access is via the
        // authenticated /resumes/:id/content and /:id/download endpoints; this
        // link is only a fallback, so it must not be a long-lived capability URL)
        const { data: signed, error: signError } = await db_1.supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(storagePath, 3600);
        if (signError)
            throw signError;
        const filelink = signed.signedUrl;
        // Ensure the user record exists
        await ensureUserRecord(userId, ((_b = req.user) === null || _b === void 0 ? void 0 : _b.email) || '');
        // Save the resume row
        const { data: savedRow, error: saveError } = await db_1.supabaseAdmin
            .from('resumes')
            .insert({
            user_id: userId,
            filename: uniqueFilename,
            filelink,
            file_hash: fileHash,
            analysis: analysisJson,
            vendor_id: vendor_id || null,
            vendor_name: vendor_name || null,
        })
            .select('*')
            .single();
        if (saveError)
            throw saveError;
        return res.status(201).json({ analysis: analysisJson, savedData: (0, Resume_1.toResume)(savedRow) });
    }
    catch (error) {
        console.error('Error analyzing and uploading resume:', error);
        if ((0, db_1.httpStatusForDbError)(error) === 409) {
            return res.status(409).json({ error: 'This resume has already been uploaded' });
        }
        return res.status(500).json({ error: 'Failed to save resume' });
    }
};
exports.analyzeAndUpload = analyzeAndUpload;
// Stream a resume's file out of Supabase Storage with auth-correct ownership already checked
// by the caller. Shared by /resumes/:id/content, /resumes/:id/download and the
// job candidate file route.
const streamResumeToClient = async (res, resume, asDownload) => {
    const storagePath = `resumes/${resume.user_id}/${resume.filename}`;
    try {
        const { data: blob, error } = await db_1.supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .download(storagePath);
        if (error) {
            if (error.message.toLowerCase().includes('not found') || error.statusCode === '404') {
                return res.status(404).json({ error: 'Resume file not found in storage' });
            }
            throw error;
        }
        const bytes = Buffer.from(await blob.arrayBuffer());
        res.setHeader('Content-Type', blob.type || 'application/octet-stream');
        if (asDownload) {
            const safeName = resume.filename.replace(/[^\w.\-]/g, '_');
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
        }
        return res.status(200).send(bytes);
    }
    catch (error) {
        console.error('Error streaming resume file:', error);
        return res.status(500).json({ error: 'Failed to fetch resume file' });
    }
};
exports.streamResumeToClient = streamResumeToClient;
// View a resume file (owner only) — used by the profiles page viewer
const getResumeContent = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!(0, db_1.isUuid)(id)) {
            return res.status(400).json({ error: 'Invalid id' });
        }
        const resume = await findResumeByIdForUser(id, userId);
        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        return (0, exports.streamResumeToClient)(res, resume, false);
    }
    catch (error) {
        console.error('Error fetching resume content:', error);
        return res.status(500).json({ error: 'Failed to fetch resume content' });
    }
};
exports.getResumeContent = getResumeContent;
// Download a resume file (owner only) — used by the profiles page download
const getResumeDownload = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!(0, db_1.isUuid)(id)) {
            return res.status(400).json({ error: 'Invalid id' });
        }
        const resume = await findResumeByIdForUser(id, userId);
        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        return (0, exports.streamResumeToClient)(res, resume, true);
    }
    catch (error) {
        console.error('Error downloading resume:', error);
        return res.status(500).json({ error: 'Failed to download resume' });
    }
};
exports.getResumeDownload = getResumeDownload;
// Check if a resume with the given hash already exists for this user
const checkDuplicateResume = async (req, res) => {
    var _a;
    try {
        const { fileHash, userId } = req.body;
        // Try to get userId from request body if not in req.user (for bypass auth mode)
        const userIdentifier = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) || userId;
        if (!userIdentifier || !fileHash) {
            return res.status(400).json({ error: 'Missing required fields: userId or fileHash' });
        }
        // Check for duplicate
        const { data, error } = await db_1.supabaseAdmin
            .from('resumes')
            .select('id')
            .eq('user_id', userIdentifier)
            .eq('file_hash', fileHash)
            .limit(1);
        if (error)
            throw error;
        return res.status(200).json({ isDuplicate: !!(data && data.length > 0) });
    }
    catch (error) {
        console.error('Error checking for duplicate resume:', error);
        return res.status(500).json({ error: 'Failed to check for duplicate resume' });
    }
};
exports.checkDuplicateResume = checkDuplicateResume;
// Save resume data (client-side analyzed fallback path)
const saveResume = async (req, res) => {
    var _a, _b;
    try {
        const { filename, filelink, fileHash, analysis, vendor_id, vendor_name, userId } = req.body;
        const userIdentifier = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) || userId;
        if (!userIdentifier) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Check if user exists in database (create if missing)
        await ensureUserRecord(userIdentifier, ((_b = req.user) === null || _b === void 0 ? void 0 : _b.email) || '');
        // Check for duplicate resume
        const { data: existingResume, error: dupError } = await db_1.supabaseAdmin
            .from('resumes')
            .select('id')
            .eq('user_id', userIdentifier)
            .eq('file_hash', fileHash)
            .limit(1);
        if (dupError)
            throw dupError;
        if (existingResume && existingResume.length > 0) {
            return res.status(409).json({ error: 'This resume has already been uploaded' });
        }
        // Create new resume
        const { data: newResume, error: createError } = await db_1.supabaseAdmin
            .from('resumes')
            .insert({
            user_id: userIdentifier,
            filename,
            filelink,
            file_hash: fileHash,
            analysis: analysis !== null && analysis !== void 0 ? analysis : null,
            vendor_id: vendor_id || null,
            vendor_name: vendor_name || null,
        })
            .select('*')
            .single();
        if (createError)
            throw createError;
        return res.status(201).json((0, Resume_1.toResume)(newResume));
    }
    catch (error) {
        console.error('Error saving resume:', error);
        if ((0, db_1.httpStatusForDbError)(error) === 409) {
            return res.status(409).json({ error: 'This resume has already been uploaded' });
        }
        return res.status(500).json({ error: 'Failed to save resume' });
    }
};
exports.saveResume = saveResume;
// Get all resumes for a user
const getUserResumes = async (req, res) => {
    var _a, _b;
    try {
        // Try to get userId from multiple places (token first, always)
        const queryUserId = req.query.userId;
        const bodyUserId = (_a = req.body) === null || _a === void 0 ? void 0 : _a.userId;
        const userIdentifier = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.uid) || queryUserId || bodyUserId;
        if (!userIdentifier) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { data: resumes, error } = await db_1.supabaseAdmin
            .from('resumes')
            .select('*')
            .eq('user_id', userIdentifier)
            .order('uploaded_at', { ascending: false });
        if (error)
            throw error;
        return res.status(200).json((resumes !== null && resumes !== void 0 ? resumes : []).map((row) => (0, Resume_1.toResume)(row)));
    }
    catch (error) {
        console.error('Error fetching resumes:', error);
        return res.status(500).json({ error: 'Failed to fetch resumes' });
    }
};
exports.getUserResumes = getUserResumes;
// Get a single resume by ID
const getResumeById = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const resume = await findResumeByIdForUser(id, userId);
        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        return res.status(200).json((0, Resume_1.toResume)(resume));
    }
    catch (error) {
        console.error('Error fetching resume:', error);
        return res.status(500).json({ error: 'Failed to fetch resume' });
    }
};
exports.getResumeById = getResumeById;
// Delete a resume by ID
const deleteResume = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { data: deleted, error } = await db_1.supabaseAdmin
            .from('resumes')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)
            .select('id');
        if (error)
            throw error;
        if (!deleted || deleted.length === 0) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        return res.status(200).json({ message: 'Resume deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting resume:', error);
        if ((0, db_1.httpStatusForDbError)(error) === 400) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        return res.status(500).json({ error: 'Failed to delete resume' });
    }
};
exports.deleteResume = deleteResume;
// Add this new function to get all resumes (for admin users)
const getAllResumes = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to access all resumes' });
        }
        // Get all resumes
        const { data: resumes, error } = await db_1.supabaseAdmin
            .from('resumes')
            .select('*')
            .order('uploaded_at', { ascending: false });
        if (error)
            throw error;
        return res.status(200).json((resumes !== null && resumes !== void 0 ? resumes : []).map((row) => (0, Resume_1.toResume)(row)));
    }
    catch (error) {
        console.error('Error fetching all resumes:', error);
        return res.status(500).json({ error: 'Failed to fetch all resumes' });
    }
};
exports.getAllResumes = getAllResumes;
// ---------------------------------------------------------------------------
// Company feedback (was Firestore users/{uid}/resumes/feedback)
// ---------------------------------------------------------------------------
// GET /resumes/feedback?filename=... — caller's own feedback for one resume
const getFeedback = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const filename = req.query.filename;
        if (typeof filename !== 'string' || !filename) {
            return res.status(400).json({ error: 'Missing required query param: filename' });
        }
        const { data, error } = await db_1.supabaseAdmin
            .from('company_feedback')
            .select('*')
            .eq('user_id', userId)
            .eq('filename', filename)
            .order('created_at', { ascending: true });
        if (error)
            throw error;
        return res.status(200).json(data !== null && data !== void 0 ? data : []);
    }
    catch (error) {
        console.error('Error fetching feedback:', error);
        return res.status(500).json({ error: 'Failed to fetch feedback' });
    }
};
exports.getFeedback = getFeedback;
// POST /resumes/feedback — append one feedback entry for the caller's resume
const addFeedback = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { filename, filelink, company_name, feedback } = req.body || {};
        if (typeof filename !== 'string' || !filename.trim() ||
            typeof company_name !== 'string' || !company_name.trim() ||
            typeof feedback !== 'string' || !feedback.trim()) {
            return res.status(400).json({ error: 'filename, company_name and feedback are required' });
        }
        const { data: row, error } = await db_1.supabaseAdmin
            .from('company_feedback')
            .insert({
            user_id: userId,
            filename: filename.trim(),
            filelink: typeof filelink === 'string' ? filelink : null,
            company_name: company_name.trim(),
            feedback: feedback.trim(),
        })
            .select('*')
            .single();
        if (error)
            throw error;
        return res.status(201).json(row);
    }
    catch (error) {
        console.error('Error adding feedback:', error);
        return res.status(500).json({ error: 'Failed to add feedback' });
    }
};
exports.addFeedback = addFeedback;
