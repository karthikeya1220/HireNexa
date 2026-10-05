import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import dotenv from 'dotenv';
import { supabaseAdmin, PG_UNIQUE_VIOLATION } from '../db';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
// Optional: only consulted for legacy HS256-signed tokens (old projects).
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!SUPABASE_URL && process.env.NODE_ENV === 'production') {
  console.error('FATAL: SUPABASE_URL must be set — token verification uses the project JWKS');
  process.exit(1);
}
if (!SUPABASE_URL) {
  console.warn('[AUTH] SUPABASE_URL not set — every request will be rejected with 401');
}

// Public keys for verifying asymmetric (ES256/RS256) access tokens. jose fetches
// lazily, caches, and re-fetches when an unknown `kid` shows up (key rotation).
const jwks = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), {
      cacheMaxAge: 10 * 60 * 1000,
      cooldownDuration: 30 * 1000,
      timeoutDuration: 5 * 1000,
    })
  : null;

const legacyJwtSecret = SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(SUPABASE_JWT_SECRET)
  : null;

const verifyToken = (token: string) => {
  const { alg } = decodeProtectedHeader(token);
  if (alg === 'HS256') {
    if (!legacyJwtSecret) {
      throw new Error('HS256 token received but SUPABASE_JWT_SECRET is not set');
    }
    return jwtVerify(token, legacyJwtSecret, { audience: 'authenticated' });
  }
  if (!jwks) throw new Error('SUPABASE_URL is not set');
  return jwtVerify(token, jwks, { audience: 'authenticated', algorithms: ['ES256', 'RS256'] });
};

// Extend Request to include user data
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
    role?: string;
    [key: string]: unknown;
  };
}

interface DbUserRow {
  uid: string;
  email: string;
  name?: string | null;
  role?: string | null;
}

const findUser = async (uid: string): Promise<DbUserRow | null> => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('uid, email, name, role')
    .eq('uid', uid)
    .maybeSingle();
  if (error) {
    console.error('[AUTH] users lookup failed:', error.message);
    return null;
  }
  return data;
};

const createUserRecord = async (uid: string, email: string, name: string): Promise<DbUserRow | null> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({ uid, email, name, role: 'user', profile_complete: false })
      .select('uid, email, name, role')
      .single();
    if (error) throw error;
    return data;
  } catch (createError) {
    const code = typeof createError === 'object' && createError !== null && 'code' in createError
      ? (createError as { code?: string }).code
      : undefined;
    if (code === PG_UNIQUE_VIOLATION) return findUser(uid); // lost a race — row now exists
    console.error('[AUTH] Error creating user record:', createError);
    return null; // old behavior: continue even if user creation fails
  }
};

// Authenticate users with a Supabase access token (signature verified against
// the project's published JWKS; identity is never trusted from the body).
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const idToken = authHeader.slice('Bearer '.length);

    let uid: string;
    let tokenEmail: string;
    let tokenName: string | undefined;
    try {
      const { payload } = await verifyToken(idToken);
      if (!payload.sub) throw new Error('Token missing subject');
      uid = payload.sub;
      tokenEmail = typeof payload.email === 'string' ? payload.email : '';
      tokenName = typeof payload.name === 'string' ? payload.name : undefined;
    } catch (tokenError: unknown) {
      const errorMessage = tokenError instanceof Error ? tokenError.message : 'Unknown error';
      console.error('[AUTH] Token verification failed:', errorMessage);
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    let user = await findUser(uid);
    if (!user) {
      user = await createUserRecord(uid, tokenEmail, tokenName || tokenEmail.split('@')[0] || '');
    }

    req.user = {
      uid,
      email: user?.email || tokenEmail,
      role: user?.role || 'user',
      name: user?.name || tokenName || '',
    };

    return next();
  } catch (error) {
    console.error('[AUTH] Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Middleware to check if user has admin role
export const isAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Role always comes fresh from the database so revocations take effect
    const user = await findUser(req.user.uid);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized: Admin access required' });
    }

    req.user.role = user.role;
    next();
  } catch (error) {
    console.error('Error in isAdmin middleware:', error);
    res.status(500).json({ error: 'Error checking admin status' });
  }
};
