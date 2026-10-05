import express from 'express';
import { 
  checkDuplicateResume, 
  saveResume, 
  getUserResumes, 
  getResumeById, 
  deleteResume, 
  getAllResumes,
  analyzeAndUpload,
  getResumeContent,
  getResumeDownload,
  getFeedback,
  addFeedback
} from '../controllers/resumeController';
import { authenticate, isAdmin } from '../middlewares/authMiddleware';
import { aiDailyQuota } from '../middlewares/aiQuota';

const router = express.Router();

// CORS is applied once at the server level (api/server.ts) — no per-router layer.

// Apply authentication middleware to all routes
router.use(authenticate);

// Admin routes (must come before routes with params)
router.get('/admin/all', isAdmin, getAllResumes);

// Full AI analysis + S3 upload + save pipeline (server-side secrets) —
// per-user daily quota so one account cannot burn unlimited AI credit
router.post('/analyze', aiDailyQuota, analyzeAndUpload);

// Resume routes with query parameters (must come before routes with :id)
router.get('/', getUserResumes);

// Company feedback for one resume (was Firestore) — must come before /:id
router.get('/feedback', getFeedback);
router.post('/feedback', addFeedback);

// Standard resume routes
router.post('/check-duplicate', checkDuplicateResume);
router.post('/', saveResume);
router.get('/:id', getResumeById);
router.get('/:id/content', getResumeContent);
router.get('/:id/download', getResumeDownload);
router.delete('/:id', deleteResume);

export default router;