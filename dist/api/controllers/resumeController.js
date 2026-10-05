"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllResumes = exports.deleteResume = exports.getResumeById = exports.getUserResumes = exports.saveResume = exports.checkDuplicateResume = exports.getResumeDownload = exports.getResumeContent = exports.streamResumeToClient = exports.analyzeAndUpload = void 0;
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const Resume_1 = __importDefault(require("../models/Resume"));
const AWSConfig_1 = require("../../AWSConfig");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const uuid_1 = require("uuid");
const gemini_1 = require("../utils/gemini");
const User_1 = __importDefault(require("../models/User"));
// Full resume pipeline, server-side: hash -> duplicate check -> AI analysis
// -> S3 upload -> signed URL -> save. Replaces the old client-side flow that
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
        const existingResume = await Resume_1.default.findOne({
            user_id: userId,
            fileHash: fileHash,
        });
        if (existingResume) {
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
        // Upload file to AWS S3
        const s3Key = `resumes/${userId}/${uniqueFilename}`;
        await AWSConfig_1.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: AWSConfig_1.bucketName,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: file.type,
        }));
        // Generate a signed URL (valid for 7 days)
        const filelink = await (0, s3_request_presigner_1.getSignedUrl)(AWSConfig_1.s3Client, new client_s3_1.GetObjectCommand({
            Bucket: AWSConfig_1.bucketName,
            Key: s3Key,
        }), { expiresIn: 604800 });
        // Ensure the user record exists
        const user = await User_1.default.findOne({ uid: userId });
        if (!user) {
            try {
                await User_1.default.create({
                    uid: userId,
                    email: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.email) || '',
                    role: 'user',
                    created_at: new Date(),
                    updated_at: new Date(),
                });
            }
            catch (createError) {
                console.error('Error creating user record:', createError);
                // Continue even if user creation fails
            }
        }
        // Save to MongoDB
        const savedData = await Resume_1.default.create({
            user_id: userId,
            filename: uniqueFilename,
            filelink,
            fileHash,
            analysis: analysisJson,
            vendor_id: vendor_id || null,
            vendor_name: vendor_name || null,
        });
        return res.status(201).json({ analysis: analysisJson, savedData });
    }
    catch (error) {
        console.error('Error analyzing and uploading resume:', error);
        if ((error === null || error === void 0 ? void 0 : error.code) === 11000) {
            return res.status(409).json({ error: 'This resume has already been uploaded' });
        }
        return res.status(500).json({ error: 'Failed to save resume' });
    }
};
exports.analyzeAndUpload = analyzeAndUpload;
// Stream a resume's file out of S3 with auth-correct ownership already checked
// by the caller. Shared by /resumes/:id/content, /resumes/:id/download and the
// job candidate file route.
const streamResumeToClient = async (res, resume, asDownload) => {
    var _a;
    const key = `resumes/${resume.user_id}/${resume.filename}`;
    try {
        const object = await AWSConfig_1.s3Client.send(new client_s3_1.GetObjectCommand({ Bucket: AWSConfig_1.bucketName, Key: key }));
        const body = object.Body;
        if (!(body === null || body === void 0 ? void 0 : body.transformToByteArray)) {
            throw new Error('Unexpected S3 response body type');
        }
        const bytes = await body.transformToByteArray();
        res.setHeader('Content-Type', object.ContentType || 'application/octet-stream');
        if (asDownload) {
            const safeName = resume.filename.replace(/[^\w.\-]/g, '_');
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
        }
        return res.status(200).send(Buffer.from(bytes));
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.name) === 'NoSuchKey' || ((_a = error === null || error === void 0 ? void 0 : error.$metadata) === null || _a === void 0 ? void 0 : _a.httpStatusCode) === 404) {
            return res.status(404).json({ error: 'Resume file not found in storage' });
        }
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
        const resume = await Resume_1.default.findOne({ _id: id, user_id: userId });
        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        return (0, exports.streamResumeToClient)(res, resume, false);
    }
    catch (error) {
        console.error('Error fetching resume content:', error);
        if ((error === null || error === void 0 ? void 0 : error.name) === 'CastError') {
            return res.status(400).json({ error: 'Invalid id' });
        }
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
        const resume = await Resume_1.default.findOne({ _id: id, user_id: userId });
        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        return (0, exports.streamResumeToClient)(res, resume, true);
    }
    catch (error) {
        console.error('Error downloading resume:', error);
        if ((error === null || error === void 0 ? void 0 : error.name) === 'CastError') {
            return res.status(400).json({ error: 'Invalid id' });
        }
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
        const existingResume = await Resume_1.default.findOne({
            user_id: userIdentifier,
            fileHash: fileHash
        });
        return res.status(200).json({ isDuplicate: !!existingResume });
    }
    catch (error) {
        console.error('Error checking for duplicate resume:', error);
        return res.status(500).json({ error: 'Failed to check for duplicate resume' });
    }
};
exports.checkDuplicateResume = checkDuplicateResume;
// Save resume data to MongoDB
const saveResume = async (req, res) => {
    var _a, _b;
    try {
        const { filename, filelink, fileHash, analysis, vendor_id, vendor_name, userId } = req.body;
        const userIdentifier = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) || userId;
        if (!userIdentifier) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Check if user exists in database
        const user = await User_1.default.findOne({ uid: userIdentifier });
        if (!user) {
            // Create user if doesn't exist
            try {
                await User_1.default.create({
                    uid: userIdentifier,
                    email: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.email) || '',
                    role: 'user',
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }
            catch (createError) {
                console.error('Error creating user record:', createError);
                // Continue even if user creation fails
            }
        }
        // Check for duplicate resume
        const existingResume = await Resume_1.default.findOne({
            user_id: userIdentifier,
            fileHash: fileHash
        });
        if (existingResume) {
            return res.status(409).json({ error: 'This resume has already been uploaded' });
        }
        // Create new resume
        const newResume = await Resume_1.default.create({
            user_id: userIdentifier,
            filename,
            filelink,
            fileHash,
            analysis,
            vendor_id: vendor_id || null,
            vendor_name: vendor_name || null,
        });
        return res.status(201).json(newResume);
    }
    catch (error) {
        console.error('Error saving resume:', error);
        return res.status(500).json({ error: 'Failed to save resume' });
    }
};
exports.saveResume = saveResume;
// Get all resumes for a user
const getUserResumes = async (req, res) => {
    var _a, _b;
    try {
        // Debug logs to help troubleshoot
        console.log('Request query:', req.query);
        console.log('Request body:', req.body);
        console.log('Request user:', req.user);
        // Try to get userId from multiple places
        const queryUserId = req.query.userId;
        const bodyUserId = (_a = req.body) === null || _a === void 0 ? void 0 : _a.userId;
        const userIdentifier = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.uid) || queryUserId || bodyUserId;
        console.log('Using User ID:', userIdentifier);
        if (!userIdentifier) {
            console.log('No user identifier found in request');
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const resumes = await Resume_1.default.find({ user_id: userIdentifier }).sort({ uploaded_at: -1 });
        console.log('Resumes found:', resumes.length);
        return res.status(200).json(resumes);
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
        const resume = await Resume_1.default.findOne({ _id: id, user_id: userId });
        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        return res.status(200).json(resume);
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
        const deletedResume = await Resume_1.default.findOneAndDelete({ _id: id, user_id: userId });
        if (!deletedResume) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        return res.status(200).json({ message: 'Resume deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting resume:', error);
        return res.status(500).json({ error: 'Failed to delete resume' });
    }
};
exports.deleteResume = deleteResume;
// Add this new function to get all resumes (for admin users)
const getAllResumes = async (req, res) => {
    var _a;
    try {
        // Only admin users should be allowed to access all resumes
        console.log('Getting all resumes, user role:', (_a = req.user) === null || _a === void 0 ? void 0 : _a.role);
        if (!req.user) {
            console.log('User not authenticated for getAllResumes');
            return res.status(401).json({ error: 'Not authenticated' });
        }
        if (req.user.role !== 'admin') {
            console.log('User not authorized to access all resumes:', req.user.uid);
            return res.status(403).json({ error: 'Not authorized to access all resumes' });
        }
        // Get all resumes
        const resumes = await Resume_1.default.find({}).sort({ uploaded_at: -1 });
        console.log(`Found ${resumes.length} resumes in total`);
        return res.status(200).json(resumes);
    }
    catch (error) {
        console.error('Error fetching all resumes:', error);
        return res.status(500).json({ error: 'Failed to fetch all resumes' });
    }
};
exports.getAllResumes = getAllResumes;
