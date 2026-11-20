import express from 'express';
import { getPublicJobDetails, submitPublicCandidate } from '../controllers/portalController';
import { aiDailyQuota } from '../middlewares/aiQuota';

const router = express.Router();

// Public routes for candidates / vendors (no authentication required)
router.get('/:jobId', getPublicJobDetails);
router.post('/:jobId/apply', aiDailyQuota, submitPublicCandidate);

export default router;
