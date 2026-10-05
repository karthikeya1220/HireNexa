import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

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
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY || 'service-role-placeholder',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Postgres error codes we surface with specific HTTP statuses.
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_CHECK_VIOLATION = '23514';
export const PG_INVALID_INPUT = '22P02';

// Throw the first PostgREST error so `catch` blocks can map it.
export const throwOnError = (error: { message: string } | null): void => {
  if (error) throw error;
};

// Map a caught DB error to an HTTP status, or null when it should be a 500.
export const httpStatusForDbError = (error: unknown): number | null => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined;
  if (code === PG_UNIQUE_VIOLATION) return 409;
  if (code === PG_CHECK_VIOLATION || code === PG_INVALID_INPUT) return 400;
  return null;
};

// Fast, dependency-free UUID check so bad :id params never reach PostgREST.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string): boolean => UUID_RE.test(value);
