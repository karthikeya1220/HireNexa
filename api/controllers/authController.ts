import { Request, Response } from 'express';
import { supabaseAdmin, httpStatusForDbError } from '../db';
import { toPublicUser, IUser } from '../models/User';

// Define interface for authenticated request
interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
    role?: string;
    [key: string]: unknown;
  };
}

const findUser = async (uid: string): Promise<IUser | null> => {
  const { data, error } = await supabaseAdmin.from('users').select('*').eq('uid', uid).maybeSingle();
  if (error) throw error;
  return data;
};

// Get current user data
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await findUser(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// Update user data
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const { email, name, role, profile_complete } = req.body;

    // Identity always comes from the verified token — never from the body.
    if (!userId) {
      return res.status(401).json({ error: 'User ID is required' });
    }

    const user = await findUser(userId);

    // If user doesn't exist, create a new one (email falls back to the token's)
    if (!user) {
      const finalEmail = email || req.user?.email;
      if (!finalEmail) {
        return res.status(400).json({ error: 'Email is required when creating a new user' });
      }

      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          uid: userId,
          email: finalEmail,
          name: (typeof name === 'string' && name.trim()) || finalEmail.split('@')[0],
          role: 'user', // Role is never taken from the client payload
          profile_complete: profile_complete === true,
        })
        .select('*')
        .single();
      if (createError) throw createError;

      return res.status(201).json(toPublicUser(newUser));
    }

    // Update existing user with any provided fields
    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (email && typeof email === 'string') updateData.email = email;
    if (typeof profile_complete === 'boolean') updateData.profile_complete = profile_complete;
    if (role && req.user?.role === 'admin') updateData.role = role; // Only admins can update roles

    let updated = user;
    if (Object.keys(updateData).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('uid', userId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return res.status(404).json({ error: 'User not found' });
      }
      updated = data;
    }

    return res.status(200).json(toPublicUser(updated));
  } catch (error) {
    console.error('Error updating user:', error);
    if (httpStatusForDbError(error) === 409) {
      return res.status(409).json({ error: 'A user with that email already exists' });
    }
    return res.status(500).json({ error: 'Failed to update user' });
  }
};

// Admin only: Get all users
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('uid, email, name, role, created_at');
    if (error) throw error;

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Admin only: Update user role
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const { uid, role } = req.body;

    if (!uid || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['admin', 'user', 'recruiter'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({ role })
      .eq('uid', uid)
      .select('*')
      .maybeSingle();
    if (error) throw error;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(toPublicUser(user));
  } catch (error) {
    console.error('Error updating user role:', error);
    if (httpStatusForDbError(error) === 400) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    return res.status(500).json({ error: 'Failed to update user role' });
  }
};

// Create the user record for the currently authenticated user.
// Requires the `authenticate` middleware: uid/email come from the verified
// token and can never be spoofed via the request body.
export const createUserFromAuth = async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email;
    const { name } = req.body || {};

    if (!uid || !email) {
      return res.status(401).json({ error: 'Authenticated user with an email is required' });
    }

    const existingUser = await findUser(uid);

    if (existingUser) {
      return res.status(200).json({
        message: 'User already exists',
        user: toPublicUser(existingUser),
      });
    }

    try {
      const { data: newUser, error } = await supabaseAdmin
        .from('users')
        .insert({
          uid,
          email,
          name: (typeof name === 'string' && name.trim()) || email.split('@')[0],
          role: 'user', // Role is always assigned server-side
        })
        .select('*')
        .single();
      if (error) throw error;

      return res.status(201).json({
        message: 'User created successfully',
        user: toPublicUser(newUser),
      });
    } catch (saveError) {
      if (httpStatusForDbError(saveError) === 409) {
        const conflictUser = await findUser(uid);
        if (conflictUser) {
          return res.status(200).json({
            message: 'User already exists',
            user: toPublicUser(conflictUser),
          });
        }
      }
      throw saveError;
    }
  } catch (error) {
    console.error('Error creating user from auth:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
};
