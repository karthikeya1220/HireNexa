"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = exports.authenticate = void 0;
const jose_1 = require("jose");
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("../db");
dotenv_1.default.config();
const SUPABASE_URL = (_a = process.env.SUPABASE_URL) === null || _a === void 0 ? void 0 : _a.replace(/\/+$/, '');
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
    ? (0, jose_1.createRemoteJWKSet)(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), {
        cacheMaxAge: 10 * 60 * 1000,
        cooldownDuration: 30 * 1000,
        timeoutDuration: 5 * 1000,
    })
    : null;
const legacyJwtSecret = SUPABASE_JWT_SECRET
    ? new TextEncoder().encode(SUPABASE_JWT_SECRET)
    : null;
const verifyToken = (token) => {
    const { alg } = (0, jose_1.decodeProtectedHeader)(token);
    if (alg === 'HS256') {
        if (!legacyJwtSecret) {
            throw new Error('HS256 token received but SUPABASE_JWT_SECRET is not set');
        }
        return (0, jose_1.jwtVerify)(token, legacyJwtSecret, { audience: 'authenticated' });
    }
    if (!jwks)
        throw new Error('SUPABASE_URL is not set');
    return (0, jose_1.jwtVerify)(token, jwks, { audience: 'authenticated', algorithms: ['ES256', 'RS256'] });
};
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
// Authenticate users with a Supabase access token (signature verified against
// the project's published JWKS; identity is never trusted from the body).
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
            const { payload } = await verifyToken(idToken);
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
