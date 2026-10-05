/* eslint-disable */
// Set a user's role (default: admin) in public.users, matched by email.
// The auth user must already exist (created by the migration script or by
// signing in once — the API auto-provisions public.users rows on first use).
//
// Usage:
//   node api/scripts/make-admin.js <email> [--role admin|user|recruiter]
//   node api/scripts/make-admin.js --list

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ROLES = new Set(['user', 'admin', 'recruiter']);

async function findAuthUserByEmail(email) {
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data?.users || [];
    const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    const { data, error } = await supabase
      .from('users')
      .select('uid, email, name, role, profile_complete, created_at')
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    console.log(`\nAll users (${data.length}):`);
    for (const u of data) {
      console.log(`- ${u.email} (${u.uid}), role: ${u.role}, profile_complete: ${u.profile_complete}`);
    }
    return;
  }

  const email = args.find((a) => !a.startsWith('--'));
  const roleArgIndex = args.indexOf('--role');
  const role = roleArgIndex >= 0 ? args[roleArgIndex + 1] : 'admin';

  if (!email || !email.includes('@')) {
    console.error('Usage: node api/scripts/make-admin.js <email> [--role admin|user|recruiter]');
    console.error('       node api/scripts/make-admin.js --list');
    process.exit(1);
  }
  if (!ROLES.has(role)) {
    console.error(`Invalid role "${role}" — expected one of: ${[...ROLES].join(', ')}`);
    process.exit(1);
  }

  console.log(`Looking up auth user: ${email}`);
  const authUser = await findAuthUserByEmail(email);
  if (!authUser) {
    console.error(`No Supabase auth user with email ${email}.`);
    console.error('Run the migration script or have the user sign in once, then retry.');
    process.exit(1);
  }

  const { data: existing, error: readError } = await supabase
    .from('users')
    .select('role')
    .eq('uid', authUser.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  let error;
  if (existing) {
    ({ error } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('uid', authUser.id));
  } else {
    ({ error } = await supabase.from('users').insert({
      uid: authUser.id,
      email: authUser.email,
      name: authUser.user_metadata?.name || email.split('@')[0],
      role,
    }));
  }
  if (error) throw new Error(error.message);

  console.log(`User ${email} role set to: ${role} (uid: ${authUser.id})`);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
