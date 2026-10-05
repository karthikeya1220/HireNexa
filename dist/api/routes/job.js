"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jobController_1 = require("../controllers/jobController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
// CORS is applied once at the server level (api/server.ts) — no per-router layer.
// Apply authentication middleware to all routes
router.use(authMiddleware_1.authenticate);
// AI match analysis (Gemini runs server-side only)
router.post('/match-analysis', jobController_1.analyzeMatches);
// Job routes - accessible by all authenticated users
router.get('/', jobController_1.getAllJobs);
// Get all resumes for matching — dumps all users' PII, admin only
// (must be before /:id routes)
router.get('/resumes/all', authMiddleware_1.isAdmin, jobController_1.getAllResumesForMatching);
// Job routes with ID parameter
router.get('/:id', jobController_1.getJobById);
// Job candidates routes (ownership enforced in the controller:
// admin, job creator, or assigned recruiter)
router.get('/:id/candidates', jobController_1.getJobCandidates);
router.put('/:id/candidates', jobController_1.saveJobCandidates);
router.put('/:id/candidates/:candidateId/status', jobController_1.updateCandidateStatus);
router.get('/:id/candidates/:filename/file', jobController_1.getCandidateFile);
router.get('/:id/check-new-resumes', jobController_1.checkForNewResumes);
// Job routes - accessible only by admin or job creator
router.post('/', jobController_1.createJob);
router.put('/:id', jobController_1.updateJob);
router.delete('/:id', jobController_1.deleteJob);
// Assigning recruiters to a job
router.post('/:id/recruiters', jobController_1.assignRecruiters);
exports.default = router;
