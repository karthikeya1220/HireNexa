"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const portalController_1 = require("../controllers/portalController");
const aiQuota_1 = require("../middlewares/aiQuota");
const router = express_1.default.Router();
// Public routes for candidates / vendors (no authentication required)
router.get('/:jobId', portalController_1.getPublicJobDetails);
router.post('/:jobId/apply', aiQuota_1.aiDailyQuota, portalController_1.submitPublicCandidate);
exports.default = router;
