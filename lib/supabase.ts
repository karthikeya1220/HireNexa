import { createClient, type Session, type User } from '@supabase/supabase-js';

// Browser client for Supabase Auth only (passwordless magic-link sign-in).
// The browser NEVER talks to PostgREST — all database access goes through the
// Express API, which authenticates the same JWT with the service-role backend.
//
// Implicit flow (default): the magic link carries tokens in the URL fragment
// and can be opened in any browser, so PKCE's locally-stored code verifier
// would only get in the way.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// The auth shape the app has always used (mirrors the old firebase/auth User
// fields that pages actually consume: uid / email / displayName).
export interface AuthUser {
  uid: string;
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export const toAuthUser = (user: User): AuthUser => {
  const metadata = (user.user_metadata ?? {}) as { name?: string; full_name?: string };
  const displayName = metadata.name || metadata.full_name || null;
  return {
    uid: user.id,
    id: user.id,
    email: user.email ?? null,
    displayName,
    photoURL: null,
  };
};

export const sessionUser = (session: Session | null): AuthUser | null =>
  session ? toAuthUser(session.user) : null;
