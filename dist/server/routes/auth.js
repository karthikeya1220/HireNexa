"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
// Authenticated routes — identity (uid/email) is always derived from the
// verified Firebase ID token, never from the request body.
router.post('/create-from-auth', authMiddleware_1.authenticate, authController_1.createUserFromAuth);
router.get('/me', authMiddleware_1.authenticate, authController_1.getCurrentUser);
router.put('/me', authMiddleware_1.authenticate, authController_1.updateUser);
// Admin routes
router.get('/users', authMiddleware_1.authenticate, authMiddleware_1.isAdmin, authController_1.getAllUsers);
router.put('/users/role', authMiddleware_1.authenticate, authMiddleware_1.isAdmin, authController_1.updateUserRole);
// NOTE: POST /make-admin was removed — it was unauthenticated and allowed
// privilege escalation / account hijacking. Bootstrap the first admin with
// `node api/scripts/make-admin.js <email> <uid>`, then manage roles via
// PUT /users/role (admin-only).
exports.default = router;
