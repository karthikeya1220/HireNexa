# MongoDB / Firestore → Supabase Migration Guide

This guide migrates an existing HireNexa deployment (old stack: Firebase Auth +
Firestore for profiles/feedback, MongoDB for everything else) to the current
Supabase stack. Existing accounts are preserved: each Firebase auth UID is
remapped to a new Supabase auth UUID **by email**, and every reference in the
data follows.

## What the script does

`server/scripts/migrate-to-supabase.js` (one-shot, idempotent-ish):

1. Reads Mongo collections `users`, `jobs`, `jobcandidates`, `resumes`, `vendors`.
2. Optionally reads Firestore `users/{uid}` docs (name/role/profileComplete) and
   `users/{uid}/resumes/feedback` (company feedback), if `firebase-admin`
   credentials are available.
3. Ensures a Supabase auth user exists per email — created **without a
   password**, so people keep using magic-link sign-in. Builds a
   `firebaseUid → supabaseUuid` map.
4. Inserts `public.users`, `jobs`, `job_candidates`, `resumes`, `vendors`,
   remapping every uid reference (`jobs.metadata.created_by_id`,
   `jobs.assigned_recruiters[]`, `resumes.user_id`,
   `job_candidates.user_id`, `vendors.metadata.created_by_id`).
5. Copies each S3 object from `resumes/<legacyUid>/<filename>` to
   `resumes/<supabaseUuid>/<filename>` — the API derives the S3 key from the
   current `user_id`, so old files must move or owners lose access.
6. Imports company feedback into `company_feedback` and sets
   `users.profile_complete` from Firestore.

### Things to know

- **New ids**: Mongo `_id`s are 24-hex; Postgres uses uuids, so jobs, resumes,
  candidates and vendors get new ids. Any bookmarked job URLs change once.
- **S3 copy**: needs the same AWS credentials the server uses. Objects are
  copied (not moved); delete the old prefixes yourself after verifying.
- **Re-runs**: mostly safe — existing users/jobs are skipped, duplicate
  resumes (same user + hash) are skipped, candidates upsert by
  `(job_id, filename)`.
- **Unmapped references**: a reference to a uid with no email resolves to
  nothing — the raw uid is kept and a warning is printed.

## Prerequisites

1. A Supabase project with `supabase/schema.sql` already run in the SQL Editor.
2. Node.js and npm, and `npm install` completed in the repo.
3. Env vars for the old sources **and** the new target:

```bash
# Required (server .env already has these after setup)
MONGODB_URI=mongodb+srv://user:pass@cluster/hirenexa   # OLD database
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# S3 copy (recommended — without these, resume files stay under old keys)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...

# Optional — Firestore profiles + company feedback
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY="..."   # \n newlines escaped
FIREBASE_CLIENT_EMAIL=...@...gserviceaccount.com
```

The old Firebase service-account JSON in `misc/` works too if you point
`firebase-admin` at it via `GOOGLE_APPLICATION_CREDENTIALS`.

## Steps

1. **Dry run first** — prints the full plan (counts, warnings) without writing:

   ```bash
   node server/scripts/migrate-to-supabase.js --dry-run
   ```

2. **Review the output**: account counts, uid mappings, warnings about
   unresolved references or invalid enum values.

3. **Run for real**:

   ```bash
   node server/scripts/migrate-to-supabase.js
   ```

   Useful flags:
   - `--skip-s3` — skip copying S3 objects (files stay under legacy prefixes)
   - `--skip-firestore` — skip Firestore profiles/feedback
   - `--dry-run` — no writes at all

4. **Verify**:
   ```bash
   node server/scripts/make-admin.js --list     # users + roles
   node server/scripts/make-admin.js you@example.com   # grant yourself admin
   ```
   Then sign in with the magic link and check jobs/resumes/vendors load.

5. **Cutover**: deploy the app with the Supabase env vars. Old Mongo/Firestore
   can be left in place (read-only) until you're confident.

## Post-migration checklist

- [ ] `supabase/schema.sql` applied
- [ ] Supabase **Authentication → URL Configuration**: Site URL + `{origin}/login`
      redirect URL added (dev and production)
- [ ] Migration script run (dry-run reviewed first)
- [ ] S3 objects copied to new prefixes (or consciously skipped)
- [ ] Admin roles granted via `make-admin.js`
- [ ] Magic-link sign-in works for a migrated account
- [ ] Rotate the previously leaked AWS keys and purge old secrets from git
      history (`git filter-repo`) — the repo is public
- [ ] Old `MONGODB_URI` / `FIREBASE_*` vars removed from every deployment
