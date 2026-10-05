import { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { supabaseAdmin, isUuid, httpStatusForDbError } from '../db';
import { type ResumeRow, toResume } from '../models/Resume';
import { s3Client, bucketName } from '../../AWSConfig';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { analyzeResumeBuffer, type ResumeAnalysis } from '../utils/gemini';
import { errHttpStatus, errName } from '../utils/errors';

// Define interface for request with user
interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
    role?: string;
    [key: string]: unknown;
  };
}

// Ensure a users row exists (best-effort, same tolerance as before).
const ensureUserRecord = async (uid: string, email: string): Promise<void> => {
  const { data: existing, error: findError } = await supabaseAdmin
    .from('users')
    .select('uid')
    .eq('uid', uid)
    .maybeSingle();
  if (findError) {
    console.error('Error looking up user record:', findError);
    return;
  }
  if (existing) return;
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .insert({ uid, email, role: 'user' });
    if (error) throw error;
  } catch (createError) {
    console.error('Error creating user record:', createError);
    // Continue even if user creation fails
  }
};

const findResumeByIdForUser = async (id: string, userId: string): Promise<ResumeRow | null> => {
  if (!isUuid(id)) return null;
  const { data, error } = await supabaseAdmin
    .from('resumes')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ResumeRow) ?? null;
};

// Full resume pipeline, server-side: hash -> duplicate check -> AI analysis
// -> S3 upload -> signed URL -> save. Replaces the old client-side flow that
// shipped the AWS secret key and Gemini API key to the browser.
export const analyzeAndUpload = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
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
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const { data: existingResume, error: dupError } = await supabaseAdmin
      .from('resumes')
      .select('id')
      .eq('user_id', userId)
      .eq('file_hash', fileHash)
      .limit(1);
    if (dupError) throw dupError;
    if (existingResume && existingResume.length > 0) {
      return res.status(409).json({ error: 'This resume has already been uploaded' });
    }

    // Analyze with Gemini (throws with a user-facing message on failure)
    let analysisJson: ResumeAnalysis;
    try {
      analysisJson = await analyzeResumeBuffer(fileBuffer, file.type);
    } catch (analysisError) {
      const message = (analysisError as Error).message;
      const status =
        message === 'Failed to analyze resume with AI model' ||
        message === 'Invalid JSON response from AI model'
          ? 502
          : 422;
      return res.status(status).json({ error: message });
    }

    // Generate unique filename (strip any path components from the client name)
    const safeName = path.basename(file.name).replace(/[/\\]/g, '_');
    const uniqueFilename = `${uuidv4()}_${safeName}`;

    // Upload file to AWS S3
    const s3Key = `resumes/${userId}/${uniqueFilename}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: file.type,
      })
    );

    // Generate a signed URL (valid for 1 hour — primary access is via the
    // authenticated /resumes/:id/content and /:id/download endpoints; this
    // link is only a fallback, so it must not be a long-lived capability URL)
    const filelink = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      }),
      { expiresIn: 3600 }
    );

    // Ensure the user record exists
    await ensureUserRecord(userId, req.user?.email || '');

    // Save the resume row
    const { data: savedRow, error: saveError } = await supabaseAdmin
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
    if (saveError) throw saveError;

    return res.status(201).json({ analysis: analysisJson, savedData: toResume(savedRow as ResumeRow) });
  } catch (error) {
    console.error('Error analyzing and uploading resume:', error);
    if (httpStatusForDbError(error) === 409) {
      return res.status(409).json({ error: 'This resume has already been uploaded' });
    }
    return res.status(500).json({ error: 'Failed to save resume' });
  }
};

// Stream a resume's file out of S3 with auth-correct ownership already checked
// by the caller. Shared by /resumes/:id/content, /resumes/:id/download and the
// job candidate file route.
export const streamResumeToClient = async (
  res: Response,
  resume: { user_id: string; filename: string },
  asDownload: boolean
) => {
  const key = `resumes/${resume.user_id}/${resume.filename}`;
  try {
    const object = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: key })
    );
    const body = object.Body as
      | { transformToByteArray?: () => Promise<Uint8Array> }
      | undefined;
    if (!body?.transformToByteArray) {
      throw new Error('Unexpected S3 response body type');
    }
    const bytes = await body.transformToByteArray();

    res.setHeader('Content-Type', object.ContentType || 'application/octet-stream');
    if (asDownload) {
      const safeName = resume.filename.replace(/[^\w.\-]/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    }
    return res.status(200).send(Buffer.from(bytes));
  } catch (error) {
    if (errName(error) === 'NoSuchKey' || errHttpStatus(error) === 404) {
      return res.status(404).json({ error: 'Resume file not found in storage' });
    }
    console.error('Error streaming resume file:', error);
    return res.status(500).json({ error: 'Failed to fetch resume file' });
  }
};

// View a resume file (owner only) — used by the profiles page viewer
export const getResumeContent = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    if (!isUuid(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const resume = await findResumeByIdForUser(id, userId);
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    return streamResumeToClient(res, resume, false);
  } catch (error) {
    console.error('Error fetching resume content:', error);
    return res.status(500).json({ error: 'Failed to fetch resume content' });
  }
};

// Download a resume file (owner only) — used by the profiles page download
export const getResumeDownload = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    if (!isUuid(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const resume = await findResumeByIdForUser(id, userId);
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    return streamResumeToClient(res, resume, true);
  } catch (error) {
    console.error('Error downloading resume:', error);
    return res.status(500).json({ error: 'Failed to download resume' });
  }
};

// Check if a resume with the given hash already exists for this user
export const checkDuplicateResume = async (req: AuthRequest, res: Response) => {
  try {
    const { fileHash, userId } = req.body;
    // Try to get userId from request body if not in req.user (for bypass auth mode)
    const userIdentifier = req.user?.uid || userId;

    if (!userIdentifier || !fileHash) {
      return res.status(400).json({ error: 'Missing required fields: userId or fileHash' });
    }

    // Check for duplicate
    const { data, error } = await supabaseAdmin
      .from('resumes')
      .select('id')
      .eq('user_id', userIdentifier)
      .eq('file_hash', fileHash)
      .limit(1);
    if (error) throw error;

    return res.status(200).json({ isDuplicate: !!(data && data.length > 0) });
  } catch (error) {
    console.error('Error checking for duplicate resume:', error);
    return res.status(500).json({ error: 'Failed to check for duplicate resume' });
  }
};

// Save resume data (client-side analyzed fallback path)
export const saveResume = async (req: AuthRequest, res: Response) => {
  try {
    const {
      filename,
      filelink,
      fileHash,
      analysis,
      vendor_id,
      vendor_name,
      userId
    } = req.body;

    const userIdentifier = req.user?.uid || userId;

    if (!userIdentifier) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user exists in database (create if missing)
    await ensureUserRecord(userIdentifier, req.user?.email || '');

    // Check for duplicate resume
    const { data: existingResume, error: dupError } = await supabaseAdmin
      .from('resumes')
      .select('id')
      .eq('user_id', userIdentifier)
      .eq('file_hash', fileHash)
      .limit(1);
    if (dupError) throw dupError;
    if (existingResume && existingResume.length > 0) {
      return res.status(409).json({ error: 'This resume has already been uploaded' });
    }

    // Create new resume
    const { data: newResume, error: createError } = await supabaseAdmin
      .from('resumes')
      .insert({
        user_id: userIdentifier,
        filename,
        filelink,
        file_hash: fileHash,
        analysis: analysis ?? null,
        vendor_id: vendor_id || null,
        vendor_name: vendor_name || null,
      })
      .select('*')
      .single();
    if (createError) throw createError;

    return res.status(201).json(toResume(newResume as ResumeRow));
  } catch (error) {
    console.error('Error saving resume:', error);
    if (httpStatusForDbError(error) === 409) {
      return res.status(409).json({ error: 'This resume has already been uploaded' });
    }
    return res.status(500).json({ error: 'Failed to save resume' });
  }
};

// Get all resumes for a user
export const getUserResumes = async (req: AuthRequest, res: Response) => {
  try {
    // Try to get userId from multiple places (token first, always)
    const queryUserId = req.query.userId as string;
    const bodyUserId = req.body?.userId;
    const userIdentifier = req.user?.uid || queryUserId || bodyUserId;

    if (!userIdentifier) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { data: resumes, error } = await supabaseAdmin
      .from('resumes')
      .select('*')
      .eq('user_id', userIdentifier)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;

    return res.status(200).json((resumes ?? []).map((row) => toResume(row as ResumeRow)));
  } catch (error) {
    console.error('Error fetching resumes:', error);
    return res.status(500).json({ error: 'Failed to fetch resumes' });
  }
};

// Get a single resume by ID
export const getResumeById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const resume = await findResumeByIdForUser(id, userId);

    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    return res.status(200).json(toResume(resume));
  } catch (error) {
    console.error('Error fetching resume:', error);
    return res.status(500).json({ error: 'Failed to fetch resume' });
  }
};

// Delete a resume by ID
export const deleteResume = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { data: deleted, error } = await supabaseAdmin
      .from('resumes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id');
    if (error) throw error;

    if (!deleted || deleted.length === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    return res.status(200).json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Error deleting resume:', error);
    if (httpStatusForDbError(error) === 400) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    return res.status(500).json({ error: 'Failed to delete resume' });
  }
};

// Add this new function to get all resumes (for admin users)
export const getAllResumes = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to access all resumes' });
    }

    // Get all resumes
    const { data: resumes, error } = await supabaseAdmin
      .from('resumes')
      .select('*')
      .order('uploaded_at', { ascending: false });
    if (error) throw error;

    return res.status(200).json((resumes ?? []).map((row) => toResume(row as ResumeRow)));
  } catch (error) {
    console.error('Error fetching all resumes:', error);
    return res.status(500).json({ error: 'Failed to fetch all resumes' });
  }
};

// ---------------------------------------------------------------------------
// Company feedback (was Firestore users/{uid}/resumes/feedback)
// ---------------------------------------------------------------------------

// GET /resumes/feedback?filename=... — caller's own feedback for one resume
export const getFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const filename = req.query.filename;
    if (typeof filename !== 'string' || !filename) {
      return res.status(400).json({ error: 'Missing required query param: filename' });
    }

    const { data, error } = await supabaseAdmin
      .from('company_feedback')
      .select('*')
      .eq('user_id', userId)
      .eq('filename', filename)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return res.status(200).json(data ?? []);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return res.status(500).json({ error: 'Failed to fetch feedback' });
  }
};

// POST /resumes/feedback — append one feedback entry for the caller's resume
export const addFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { filename, filelink, company_name, feedback } = req.body || {};
    if (
      typeof filename !== 'string' || !filename.trim() ||
      typeof company_name !== 'string' || !company_name.trim() ||
      typeof feedback !== 'string' || !feedback.trim()
    ) {
      return res.status(400).json({ error: 'filename, company_name and feedback are required' });
    }

    const { data: row, error } = await supabaseAdmin
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
    if (error) throw error;

    return res.status(201).json(row);
  } catch (error) {
    console.error('Error adding feedback:', error);
    return res.status(500).json({ error: 'Failed to add feedback' });
  }
};
