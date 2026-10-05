import express from 'express';
import { 
  getCurrentUser, 
  updateUser, 
  getAllUsers, 
  updateUserRole,
  createUserFromAuth
} from '../controllers/authController';
import { authenticate, isAdmin } from '../middlewares/authMiddleware';

const router = express.Router();

// Authenticated routes — identity (uid/email) is always derived from the
// verified Firebase ID token, never from the request body.
router.post('/create-from-auth', authenticate, createUserFromAuth);
router.get('/me', authenticate, getCurrentUser);
router.put('/me', authenticate, updateUser);

// Admin routes
router.get('/users', authenticate, isAdmin, getAllUsers);
router.put('/users/role', authenticate, isAdmin, updateUserRole);

// NOTE: POST /make-admin was removed — it was unauthenticated and allowed
// privilege escalation / account hijacking. Bootstrap the first admin with
// `node api/scripts/make-admin.js <email> <uid>`, then manage roles via
// PUT /users/role (admin-only).

export default router;
