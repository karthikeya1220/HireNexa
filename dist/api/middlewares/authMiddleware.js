"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = exports.authenticate = void 0;
const jose_1 = require("jose");
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("../db");
dotenv_1.default.config();
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
if (!SUPABASE_JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('FATAL: SUPABASE_JWT_SECRET must be set (Project Settings > API > JWT Secret)');
    process.exit(1);
}
if (!SUPABASE_JWT_SECRET) {
    console.warn('[AUTH] SUPABASE_JWT_SECRET not set — every request will be rejected with 401');
}
const jwtSecret = new TextEncoder().encode(SUPABASE_JWT_SECRET || 'supabase-jwt-placeholder');
const findUser = async (uid) => {
    const { data, error } = await db_1.supabaseAdmin
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
const createUserRecord = async (uid, email, name) => {
    try {
        const { data, error } = await db_1.supabaseAdmin
            .from('users')
            .insert({ uid, email, name, role: 'user', profile_complete: false })
            .select('uid, email, name, role')
            .single();
        if (error)
            throw error;
        return data;
    }
    catch (createError) {
        const code = typeof createError === 'object' && createError !== null && 'code' in createError
            ? createError.code
            : undefined;
        if (code === db_1.PG_UNIQUE_VIOLATION)
            return findUser(uid); // lost a race — row now exists
        console.error('[AUTH] Error creating user record:', createError);
        return null; // old behavior: continue even if user creation fails
    }
};
// Authenticate users with a Supabase access token (signature verified with
// the project's JWT secret; identity is never trusted from the body).
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }
        const idToken = authHeader.slice('Bearer '.length);
        let uid;
        let tokenEmail;
        let tokenName;
        try {
            const { payload } = await (0, jose_1.jwtVerify)(idToken, jwtSecret, { audience: 'authenticated' });
            if (!payload.sub)
                throw new Error('Token missing subject');
            uid = payload.sub;
            tokenEmail = typeof payload.email === 'string' ? payload.email : '';
            tokenName = typeof payload.name === 'string' ? payload.name : undefined;
        }
        catch (tokenError) {
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
            email: (user === null || user === void 0 ? void 0 : user.email) || tokenEmail,
            role: (user === null || user === void 0 ? void 0 : user.role) || 'user',
            name: (user === null || user === void 0 ? void 0 : user.name) || tokenName || '',
        };
        return next();
    }
    catch (error) {
        console.error('[AUTH] Authentication error:', error);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};
exports.authenticate = authenticate;
// Middleware to check if user has admin role
const isAdmin = async (req, res, next) => {
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
    }
    catch (error) {
        console.error('Error in isAdmin middleware:', error);
        res.status(500).json({ error: 'Error checking admin status' });
    }
};
exports.isAdmin = isAdmin;
