import { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import Resume from '../models/Resume';
import { s3Client, bucketName } from '../../AWSConfig';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { analyzeResumeBuffer } from '../utils/gemini';
import User from '../models/User';

// Define interface for request with user
interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;  // Add email to match the interface from authMiddleware
    role?: string;  // Add role to match the interface from authMiddleware
    [key: string]: any;
  };
}

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

    const existingResume = await Resume.findOne({
      user_id: userId,
      fileHash: fileHash,
    });
    if (existingResume) {
      return res.status(409).json({ error: 'This resume has already been uploaded' });
    }

    // Analyze with Gemini (throws with a user-facing message on failure)
    let analysisJson: any;
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

    // Generate a signed URL (valid for 7 days)
    const filelink = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      }),
      { expiresIn: 604800 }
    );

    // Ensure the user record exists
    const user = await User.findOne({ uid: userId });
    if (!user) {
      try {
        await User.create({
          uid: userId,
          email: req.user?.email || '',
          role: 'user',
          created_at: new Date(),
          updated_at: new Date(),
        });
      } catch (createError) {
        console.error('Error creating user record:', createError);
        // Continue even if user creation fails
      }
    }

    // Save to MongoDB
    const savedData = await Resume.create({
      user_id: userId,
      filename: uniqueFilename,
      filelink,
      fileHash,
      analysis: analysisJson,
      vendor_id: vendor_id || null,
      vendor_name: vendor_name || null,
    });

    return res.status(201).json({ analysis: analysisJson, savedData });
  } catch (error) {
    console.error('Error analyzing and uploading resume:', error);
    if ((error as any)?.code === 11000) {
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
  } catch (error: any) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
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
    const resume = await Resume.findOne({ _id: id, user_id: userId });
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    return streamResumeToClient(res, resume, false);
  } catch (error) {
    console.error('Error fetching resume content:', error);
    if ((error as any)?.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid id' });
    }
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
    const resume = await Resume.findOne({ _id: id, user_id: userId });
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    return streamResumeToClient(res, resume, true);
  } catch (error) {
    console.error('Error downloading resume:', error);
    if ((error as any)?.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid id' });
    }
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
    const existingResume = await Resume.findOne({
      user_id: userIdentifier,
      fileHash: fileHash
    });

    return res.status(200).json({ isDuplicate: !!existingResume });
  } catch (error) {
    console.error('Error checking for duplicate resume:', error);
    return res.status(500).json({ error: 'Failed to check for duplicate resume' });
  }
};

// Save resume data to MongoDB
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
    
    // Check if user exists in database
    const user = await User.findOne({ uid: userIdentifier });
    if (!user) {
      // Create user if doesn't exist
      try {
        await User.create({
          uid: userIdentifier,
          email: req.user?.email || '',
          role: 'user',
          created_at: new Date(),
          updated_at: new Date()
        });
      } catch (createError) {
        console.error('Error creating user record:', createError);
        // Continue even if user creation fails
      }
    }
    
    // Check for duplicate resume
    const existingResume = await Resume.findOne({
      user_id: userIdentifier,
      fileHash: fileHash
    });
    
    if (existingResume) {
      return res.status(409).json({ error: 'This resume has already been uploaded' });
    }
    
    // Create new resume
    const newResume = await Resume.create({
      user_id: userIdentifier,
      filename,
      filelink,
      fileHash,
      analysis,
      vendor_id: vendor_id || null,
      vendor_name: vendor_name || null,
    });
    
    return res.status(201).json(newResume);
  } catch (error) {
    console.error('Error saving resume:', error);
    return res.status(500).json({ error: 'Failed to save resume' });
  }
};

// Get all resumes for a user
export const getUserResumes = async (req: AuthRequest, res: Response) => {
  try {
    // Debug logs to help troubleshoot
    console.log('Request query:', req.query);
    console.log('Request body:', req.body);
    console.log('Request user:', req.user);
    
    // Try to get userId from multiple places
    const queryUserId = req.query.userId as string;
    const bodyUserId = req.body?.userId;
    const userIdentifier = req.user?.uid || queryUserId || bodyUserId;
    
    console.log('Using User ID:', userIdentifier);
    
    if (!userIdentifier) {
      console.log('No user identifier found in request');
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const resumes = await Resume.find({ user_id: userIdentifier }).sort({ uploaded_at: -1 });
    console.log('Resumes found:', resumes.length);
    return res.status(200).json(resumes);
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
    
    const resume = await Resume.findOne({ _id: id, user_id: userId });
    
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    
    return res.status(200).json(resume);
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
    
    const deletedResume = await Resume.findOneAndDelete({ _id: id, user_id: userId });
    
    if (!deletedResume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    
    return res.status(200).json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Error deleting resume:', error);
    return res.status(500).json({ error: 'Failed to delete resume' });
  }
};

// Add this new function to get all resumes (for admin users)
export const getAllResumes = async (req: AuthRequest, res: Response) => {
  try {
    // Only admin users should be allowed to access all resumes
    console.log('Getting all resumes, user role:', req.user?.role);
    
    if (!req.user) {
      console.log('User not authenticated for getAllResumes');
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (req.user.role !== 'admin') {
      console.log('User not authorized to access all resumes:', req.user.uid);
      return res.status(403).json({ error: 'Not authorized to access all resumes' });
    }

    // Get all resumes
    const resumes = await Resume.find({}).sort({ uploaded_at: -1 });
    console.log(`Found ${resumes.length} resumes in total`);
    return res.status(200).json(resumes);
  } catch (error) {
    console.error('Error fetching all resumes:', error);
    return res.status(500).json({ error: 'Failed to fetch all resumes' });
  }
};