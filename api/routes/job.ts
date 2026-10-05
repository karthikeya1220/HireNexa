import express from 'express';
import { 
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getJobCandidates,
  updateCandidateStatus,
  assignRecruiters,
  saveJobCandidates,
  getAllResumesForMatching,
  checkForNewResumes,
  analyzeMatches,
  getCandidateFile
} from '../controllers/jobController';
import { authenticate, isAdmin } from '../middlewares/authMiddleware';
import { aiDailyQuota } from '../middlewares/aiQuota';

const router = express.Router();

// CORS is applied once at the server level (api/server.ts) — no per-router layer.

// Apply authentication middleware to all routes
router.use(authenticate);

// AI match analysis (Gemini runs server-side only) — per-user daily quota
router.post('/match-analysis', aiDailyQuota, analyzeMatches);

// Job routes - accessible by all authenticated users
router.get('/', getAllJobs);

// Get all resumes for matching — dumps all users' PII, admin only
// (must be before /:id routes)
router.get('/resumes/all', isAdmin, getAllResumesForMatching);

// Job routes with ID parameter
router.get('/:id', getJobById);

// Job candidates routes (ownership enforced in the controller:
// admin, job creator, or assigned recruiter)
router.get('/:id/candidates', getJobCandidates);
router.put('/:id/candidates', saveJobCandidates);
router.put('/:id/candidates/:candidateId/status', updateCandidateStatus);
router.get('/:id/candidates/:filename/file', getCandidateFile);
router.get('/:id/check-new-resumes', checkForNewResumes);

// Job routes - accessible only by admin or job creator
router.post('/', createJob);
router.put('/:id', updateJob);
router.delete('/:id', deleteJob);

// Assigning recruiters to a job
router.post('/:id/recruiters', assignRecruiters);

export default router;
