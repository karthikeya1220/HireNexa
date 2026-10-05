import { Request } from 'express';

// Extend the Express Request to include user information
export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    role?: string;
    // Add other user properties as needed
  };
} 