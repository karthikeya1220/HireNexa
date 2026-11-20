"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jobController_1 = require("../controllers/jobController");
const scorecardController_1 = require("../controllers/scorecardController");
const talentPoolController_1 = require("../controllers/talentPoolController");
const communicationsController_1 = require("../controllers/communicationsController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const aiQuota_1 = require("../middlewares/aiQuota");
const router = express_1.default.Router();
// CORS is applied once at the server level (api/server.ts) — no per-router layer.
// Apply authentication middleware to all routes
router.use(authMiddleware_1.authenticate);
// AI match analysis (Gemini runs server-side only) — per-user daily quota
router.post('/match-analysis', aiQuota_1.aiDailyQuota, jobController_1.analyzeMatches);
// Job routes - accessible by all authenticated users
router.get('/', jobController_1.getAllJobs);
// Get all resumes for matching — dumps all users' PII, admin only
// (must be before /:id routes)
router.get('/resumes/all', authMiddleware_1.isAdmin, jobController_1.getAllResumesForMatching);
// Scorecards & Debrief Synthesis
router.get('/:jobId/candidates/:candidateFilename/scorecards', scorecardController_1.getScorecards);
router.post('/:jobId/candidates/:candidateFilename/scorecards', scorecardController_1.addScorecard);
router.post('/:jobId/candidates/:candidateFilename/debrief', aiQuota_1.aiDailyQuota, scorecardController_1.generateDebriefSynthesis);
// Silver Medalist Re-surfacing & Talent Graph
router.get('/:jobId/silver-medalists', talentPoolController_1.getSilverMedalists);
router.post('/:jobId/reengage', talentPoolController_1.reengageCandidate);
// Candidate Communications & Email Generation
router.post('/email/draft', aiQuota_1.aiDailyQuota, communicationsController_1.generateEmailDraft);
router.post('/:jobId/candidates/:candidateFilename/email', communicationsController_1.sendCandidateEmail);
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
