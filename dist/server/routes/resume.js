"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const resumeController_1 = require("../controllers/resumeController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const aiQuota_1 = require("../middlewares/aiQuota");
const router = express_1.default.Router();
// CORS is applied once at the server level (api/server.ts) — no per-router layer.
// Apply authentication middleware to all routes
router.use(authMiddleware_1.authenticate);
// Admin routes (must come before routes with params)
router.get('/admin/all', authMiddleware_1.isAdmin, resumeController_1.getAllResumes);
// Full AI analysis + S3 upload + save pipeline (server-side secrets) —
// per-user daily quota so one account cannot burn unlimited AI credit
router.post('/analyze', aiQuota_1.aiDailyQuota, resumeController_1.analyzeAndUpload);
// Resume routes with query parameters (must come before routes with :id)
router.get('/', resumeController_1.getUserResumes);
// Company feedback for one resume (was Firestore) — must come before /:id
router.get('/feedback', resumeController_1.getFeedback);
router.post('/feedback', resumeController_1.addFeedback);
// Standard resume routes
router.post('/check-duplicate', resumeController_1.checkDuplicateResume);
router.post('/', resumeController_1.saveResume);
router.get('/:id', resumeController_1.getResumeById);
router.get('/:id/content', resumeController_1.getResumeContent);
router.get('/:id/download', resumeController_1.getResumeDownload);
router.delete('/:id', resumeController_1.deleteResume);
exports.default = router;
