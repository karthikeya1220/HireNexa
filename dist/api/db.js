"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUuid = exports.httpStatusForDbError = exports.throwOnError = exports.PG_INVALID_INPUT = exports.PG_CHECK_VIOLATION = exports.PG_UNIQUE_VIOLATION = exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Fail fast in production — never fall back to a placeholder project
// (mirrors the old MONGODB_URI guard).
if ((!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) && process.env.NODE_ENV === 'production') {
    console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
}
// Service-role client: server-side ONLY (bypasses RLS; every query is already
// authorized by our Express middleware). Placeholders let `next dev`/build run
// without env — real calls then fail loudly at request time.
exports.supabaseAdmin = (0, supabase_js_1.createClient)(SUPABASE_URL || 'http://localhost:54321', SUPABASE_SERVICE_ROLE_KEY || 'service-role-placeholder', { auth: { persistSession: false, autoRefreshToken: false } });
// Postgres error codes we surface with specific HTTP statuses.
exports.PG_UNIQUE_VIOLATION = '23505';
exports.PG_CHECK_VIOLATION = '23514';
exports.PG_INVALID_INPUT = '22P02';
// Throw the first PostgREST error so `catch` blocks can map it.
const throwOnError = (error) => {
    if (error)
        throw error;
};
exports.throwOnError = throwOnError;
// Map a caught DB error to an HTTP status, or null when it should be a 500.
const httpStatusForDbError = (error) => {
    const code = typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined;
    if (code === exports.PG_UNIQUE_VIOLATION)
        return 409;
    if (code === exports.PG_CHECK_VIOLATION || code === exports.PG_INVALID_INPUT)
        return 400;
    return null;
};
exports.httpStatusForDbError = httpStatusForDbError;
// Fast, dependency-free UUID check so bad :id params never reach PostgREST.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value) => UUID_RE.test(value);
exports.isUuid = isUuid;
