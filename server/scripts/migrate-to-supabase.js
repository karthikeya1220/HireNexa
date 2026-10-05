/* eslint-disable */
// One-shot data migration: MongoDB (+ optional Firestore) -> Supabase Postgres.
//
// What it does:
//   1. Collects accounts from Mongo `users` (+ Firestore `users` docs when
//      firebase-admin credentials are available).
//   2. Ensures a Supabase Auth user exists for each account (passwordless —
//      they sign in with the usual magic link) and builds a legacy-UID -> UUID
//      map (Firebase auth UIDs were previously the user id everywhere).
//   3. Inserts public.users / jobs / jobcandidates / resumes / vendors rows,
//      remapping every uid reference and job id reference.
//   4. Copies S3 resume objects from resumes/<legacyUid>/ to resumes/<uuid>/
//      (the API derives the S3 key from the current user_id).
//   5. Imports company feedback from Firestore users/{uid}/resumes/feedback
//      into public.company_feedback, and profileComplete flags.
//
// Usage:
//   node api/scripts/migrate-to-supabase.js [--dry-run] [--skip-s3] [--skip-firestore]
//
// Env (required):  MONGODB_URI, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Env (S3 copy):   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME
// Env (Firestore): FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
//
// Notes:
//   * Mongo _ids are 24-hex ObjectIds; Postgres ids are uuids, so jobs/resumes/
//     candidates/vendors get NEW ids. Job links change once after migration.
//   * Re-running is mostly safe: users/jobs are checked before insert, resume
//     duplicates (same user + hash) are skipped, candidates upsert by
//     (job_id, filename).

require('dotenv').config();
const mongoose = require('mongoose');
const { createClient } = require('@supabase/supabase-js');

const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has('--dry-run');
const SKIP_S3 = argv.has('--skip-s3');
const SKIP_FIRESTORE = argv.has('--skip-firestore');

const warnings = [];
const errors = [];
const warn = (msg) => { warnings.push(msg); console.warn(`  ! ${msg}`); };
const fail = (msg) => { errors.push(msg); console.error(`  ✗ ${msg}`); };

const iso = (value) => {
  if (value === undefined || value === null) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`FATAL: ${name} is not set`);
    process.exit(1);
  }
  return value;
};

const ROLE_VALUES = new Set(['user', 'admin', 'recruiter']);
const STATUS_VALUES = new Set(['active', 'inactive']);

// auth.admin has no getUserByEmail — build the whole email->id map once.
async function loadExistingAuthUsers(supabase) {
  const byEmail = new Map();
  if (DRY_RUN) return byEmail;
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      fail(`auth listUsers failed (page ${page}): ${error.message}`);
      break;
    }
    const users = data?.users || [];
    for (const user of users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user.id);
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return byEmail;
}

async function ensureAuthUser(supabase, { email, name, legacyUid }, uidMap, existingAuth) {
  let authId = existingAuth.get(email.toLowerCase()) ?? null;

  if (!DRY_RUN && !authId) {
    // No password — accounts only ever sign in via magic link.
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error && error.code !== 'email_exists') {
      fail(`auth createUser failed for ${email}: ${error.message}`);
      return;
    }
    authId = data?.user?.id ?? null;
    if (!authId) {
      warn(`auth user ${email} exists but was not in the paged list — rerun after checking`);
      return;
    }
    existingAuth.set(email.toLowerCase(), authId);
  }

  if (!authId && DRY_RUN) authId = `dry-run:${email}`;
  if (!authId) {
    fail(`could not resolve/create auth user for ${email}`);
    return;
  }

  if (legacyUid && uidMap.has(legacyUid) && uidMap.get(legacyUid) !== authId) {
    warn(`legacy uid ${legacyUid} maps to multiple auth users; keeping ${uidMap.get(legacyUid)}`);
    return;
  }
  if (legacyUid) uidMap.set(legacyUid, authId);
  return authId;
}

async function insertIfAbsent(supabase, table, row, conflictColumn, conflictValue) {
  if (DRY_RUN) return { id: conflictValue };
  const { data: existing, error: checkError } = await supabase
    .from(table)
    .select(conflictColumn)
    .eq(conflictColumn, conflictValue)
    .limit(1);
  if (checkError) {
    fail(`${table} lookup failed (${checkError.message})`);
    return null;
  }
  if (existing && existing.length > 0) return { id: existing[0][conflictColumn], skipped: true };

  const { data, error } = await supabase.from(table).insert(row).select(conflictColumn).single();
  if (error) {
    fail(`${table} insert failed for ${conflictValue}: ${error.message}`);
    return null;
  }
  return { id: data[conflictColumn] };
}

async function main() {
  console.log(`\nSupabase migration ${DRY_RUN ? '(DRY RUN — no writes)' : ''}\n`);

  const MONGODB_URI = requireEnv('MONGODB_URI');
  const SUPABASE_URL = requireEnv('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------------------------------------------------------------- Mongo
  console.log('1. Reading MongoDB…');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const mongoUsers = await db.collection('users').find({}).toArray();
  const mongoJobs = await db.collection('jobs').find({}).toArray();
  const mongoCandidates = await db.collection('jobcandidates').find({}).toArray();
  const mongoResumes = await db.collection('resumes').find({}).toArray();
  const mongoVendors = await db.collection('vendors').find({}).toArray();
  console.log(
    `   users=${mongoUsers.length} jobs=${mongoJobs.length} candidates=${mongoCandidates.length} ` +
    `resumes=${mongoResumes.length} vendors=${mongoVendors.length}`
  );

  // ------------------------------------------------------------- Firestore
  // Optional: profiles (profileComplete/name/role) + company feedback live
  // only in Firestore.
  let firestore = null;
  let firestoreProfiles = new Map(); // firebaseUid -> {name, email, role, profileComplete}
  let firestoreFeedback = [];        // [{firebaseUid, filename, filelink, entries:[…]}]
  if (!SKIP_FIRESTORE) {
    try {
      const { default: admin } = require('firebase-admin');
      if (!admin.apps.length) {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
          }),
        });
      }
      firestore = admin.firestore();

      const usersSnap = await firestore.collection('users').get();
      for (const doc of usersSnap.docs) {
        const data = doc.data() || {};
        firestoreProfiles.set(doc.id, {
          name: data.name,
          email: data.email,
          role: data.role,
          profileComplete: data.profileComplete === true,
        });
      }

      for (const [firebaseUid, profile] of firestoreProfiles) {
        try {
          const fb = await firestore
            .collection('users')
            .doc(firebaseUid)
            .collection('resumes')
            .doc('feedback')
            .get();
          const list = fb.exists ? fb.data()?.resumes || [] : [];
          for (const item of list) {
            firestoreFeedback.push({
              firebaseUid,
              filename: item.filename,
              filelink: item.filelink || null,
              entries: item.feedback || [],
            });
          }
        } catch (e) {
          warn(`Firestore feedback read failed for ${firebaseUid}: ${e.message}`);
        }
      }
      console.log(
        `   Firestore profiles=${firestoreProfiles.size} feedbackDocs=${firestoreFeedback.length}`
      );
    } catch (e) {
      warn(`Firestore skipped (firebase-admin unavailable): ${e.message}`);
      warn('profileComplete flags and company feedback will NOT be migrated');
    }
  }

  // ------------------------------------------------------------- Accounts
  console.log('2. Resolving accounts (auth users)…');
  const existingAuth = await loadExistingAuthUsers(supabase);
  console.log(`   existing supabase auth users=${existingAuth.size}`);
  const uidMap = new Map(); // legacy uid -> supabase uuid
  const accountsByEmail = new Map(); // email -> {email, name, role, profile_complete, legacyUids: []}

  const addAccount = ({ email, name, role, profileComplete, legacyUid }) => {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      warn(`skipping account without usable email (uid=${legacyUid || 'n/a'})`);
      return;
    }
    const key = email.toLowerCase();
    const existing = accountsByEmail.get(key);
    if (!existing) {
      accountsByEmail.set(key, {
        email,
        name: name || email.split('@')[0],
        role: ROLE_VALUES.has(role) ? role : 'user',
        profile_complete: profileComplete === true,
        legacyUids: legacyUid ? [legacyUid] : [],
      });
      if (role && !ROLE_VALUES.has(role)) warn(`role "${role}" for ${email} -> 'user'`);
      return;
    }
    if (legacyUid && !existing.legacyUids.includes(legacyUid)) existing.legacyUids.push(legacyUid);
    if (!existing.profile_complete && profileComplete) existing.profile_complete = true;
    if ((!existing.name || existing.name === existing.email.split('@')[0]) && name) {
      existing.name = name;
    }
    if (role && ROLE_VALUES.has(role) && existing.role === 'user' && role !== 'user') {
      existing.role = role;
    }
  };

  for (const u of mongoUsers) {
    addAccount({
      email: u.email,
      name: u.name,
      role: u.role,
      profileComplete: undefined,
      legacyUid: u.uid,
    });
  }
  for (const [firebaseUid, profile] of firestoreProfiles) {
    addAccount({
      email: profile.email,
      name: profile.name,
      role: profile.role,
      profileComplete: profile.profileComplete,
      legacyUid: firebaseUid,
    });
  }

  const accountRows = [];
  for (const account of accountsByEmail.values()) {
    const authId = await ensureAuthUser(supabase, account, uidMap, existingAuth);
    accountRows.push({ ...account, authId });
  }

  // Legacy uids referenced by data but with no account row: try Firebase Auth
  // for an email, otherwise leave the raw uid in place (warned below).
  const referencedUids = new Set();
  const collectUid = (uid) => { if (uid && typeof uid === 'string') referencedUids.add(uid); };
  mongoJobs.forEach((j) => {
    collectUid(j.metadata?.created_by_id);
    (j.assigned_recruiters || []).forEach(collectUid);
  });
  mongoCandidates.forEach((c) => collectUid(c.userId || c.user_id));
  mongoResumes.forEach((r) => collectUid(r.user_id));
  mongoVendors.forEach((v) => collectUid(v.metadata?.created_by_id));

  for (const uid of referencedUids) {
    if (uidMap.has(uid)) continue;
    let resolved = false;
    if (firestore) {
      try {
        const profile = firestoreProfiles.get(uid);
        if (profile?.email) {
          const account = {
            email: profile.email,
            name: profile.name,
            role: profile.role,
            profileComplete: profile.profileComplete,
            legacyUid: uid,
          };
          addAccount(account);
          const authId = await ensureAuthUser(supabase, account, uidMap, existingAuth);
          accountRows.push({ ...account, authId });
          resolved = !!authId;
        }
      } catch {
        /* fall through */
      }
    }
    if (!resolved) warn(`no account for referenced uid ${uid} — reference kept as-is`);
  }

  console.log(`   accounts=${accountRows.length} uidMappings=${uidMap.size}`);
  const remapUid = (uid) => (uid && uidMap.has(uid) ? uidMap.get(uid) : uid);

  // ----------------------------------------------------------- users rows
  console.log('3. Inserting public.users…');
  const userIdSet = new Set();
  for (const account of accountRows) {
    if (!account.authId) continue;
    if (userIdSet.has(account.authId)) continue;
    const row = {
      uid: account.authId,
      email: account.email,
      name: account.name || account.email.split('@')[0],
      role: ROLE_VALUES.has(account.role) ? account.role : 'user',
      profile_complete: account.profile_complete === true,
    };
    const created = await insertIfAbsent(supabase, 'users', row, 'uid', account.authId);
    if (created?.id) userIdSet.add(account.authId);
  }
  // profileComplete enrichment for rows that already existed
  for (const account of accountRows) {
    if (!account.profile_complete || !account.authId) continue;
    if (DRY_RUN) continue;
    await supabase.from('users').update({ profile_complete: true }).eq('uid', account.authId);
  }

  // ------------------------------------------------------------------ jobs
  console.log('4. Inserting jobs…');
  const jobMap = new Map(); // mongo _id -> new uuid
  for (const job of mongoJobs) {
    const oldId = String(job._id);
    const status = STATUS_VALUES.has(job.status) ? job.status : 'active';
    if (job.status && status !== job.status) warn(`job ${oldId} status "${job.status}" -> 'active'`);
    const row = {
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      employment_type: job.employment_type,
      experience_required: job.experience_required,
      salary_range: job.salary_range,
      status,
      requirements: job.requirements || [],
      benefits: job.benefits || [],
      skills_required: job.skills_required || [],
      nice_to_have_skills: job.nice_to_have_skills || null,
      working_hours: job.working_hours || null,
      mode_of_work: job.mode_of_work || null,
      deadline: job.deadline || null,
      key_responsibilities: job.key_responsibilities || null,
      about_company: job.about_company || null,
      total_applications: job.total_applications || 0,
      shortlisted: job.shortlisted || 0,
      rejected: job.rejected || 0,
      in_progress: job.in_progress || 0,
      metadata: {
        created_by: job.metadata?.created_by || null,
        created_by_id: remapUid(job.metadata?.created_by_id) || null,
        last_modified_by: job.metadata?.last_modified_by || null,
      },
      assigned_recruiters: (job.assigned_recruiters || []).map(remapUid),
      candidates: job.candidates || [],
      created_at: iso(job.created_at),
      updated_at: iso(job.updated_at),
    };
    if (DRY_RUN) {
      jobMap.set(oldId, `dry-run-job:${oldId}`);
      continue;
    }
    const { data, error } = await supabase.from('jobs').insert(row).select('id').single();
    if (error) {
      fail(`job insert failed (${job.title}): ${error.message}`);
      continue;
    }
    jobMap.set(oldId, data.id);
  }
  console.log(`   jobs mapped=${jobMap.size}/${mongoJobs.length}`);

  // ------------------------------------------------------------ candidates
  console.log('5. Inserting job candidates…');
  const candidateKeys = new Set();
  let candidatesInserted = 0;
  for (const c of mongoCandidates) {
    const oldJobId = String(c.jobId ?? c.job_id);
    const jobId = jobMap.get(oldJobId);
    if (!jobId) {
      warn(`candidate ${c.filename}: unknown job ${oldJobId} — skipped`);
      continue;
    }
    const filename = c.filename;
    const key = `${jobId}:${filename}`;
    if (candidateKeys.has(key)) continue; // unique(job_id, filename)
    candidateKeys.add(key);

    const userId = c.userId ?? c.user_id ?? null;
    const row = {
      job_id: jobId,
      filename,
      name: c.name || 'Unknown',
      email: c.email || 'unknown@example.com',
      match_analysis: c.matchAnalysis || c.match_analysis || {},
      analysis: c.analysis || {},
      tracking: c.tracking || null,
      user_id: userId ? remapUid(userId) : null,
      user_email: c.userEmail ?? c.user_email ?? null,
      created_at: iso(c.created_at),
      updated_at: iso(c.updated_at),
    };
    if (DRY_RUN) { candidatesInserted++; continue; }
    const { error } = await supabase.from('job_candidates').insert(row);
    if (error) fail(`candidate insert failed (${filename}@${oldJobId}): ${error.message}`);
    else candidatesInserted++;
  }
  console.log(`   candidates inserted=${candidatesInserted}`);

  // --------------------------------------------------------------- resumes
  console.log(`6. Inserting resumes${SKIP_S3 ? ' (S3 copy skipped)' : ''}…`);
  let s3Client = null;
  let s3Copied = 0;
  if (!SKIP_S3) {
    const hasAws =
      process.env.AWS_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET_NAME;
    if (hasAws) {
      const { S3Client, CopyObjectCommand } = require('@aws-sdk/client-s3');
      s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      s3Client.__copy = async (srcKey, destKey) => {
        await s3Client.send(
          new CopyObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            CopySource: `${process.env.S3_BUCKET_NAME}/${encodeURIComponent(srcKey).replace(/%2F/g, '/')}`,
            Key: destKey,
          })
        );
      };
    } else {
      warn('AWS env not set — S3 objects will NOT be copied to the new uid prefix');
    }
  }

  const resumeHashes = new Set();
  let resumesInserted = 0;
  for (const r of mongoResumes) {
    const oldUid = r.user_id;
    const newUid = remapUid(oldUid);
    const dedupeKey = `${newUid}:${r.fileHash}`;
    if (resumeHashes.has(dedupeKey)) {
      warn(`duplicate resume skipped (${r.filename} for ${oldUid})`);
      continue;
    }
    resumeHashes.add(dedupeKey);

    const row = {
      user_id: newUid,
      filename: r.filename,
      filelink: r.filelink,
      file_hash: r.fileHash,
      analysis: r.analysis || null,
      vendor_id: r.vendor_id || null,
      vendor_name: r.vendor_name || null,
      uploaded_at: iso(r.uploaded_at),
      updated_at: iso(r.updated_at),
    };
    if (DRY_RUN) { resumesInserted++; continue; }
    const { error } = await supabase.from('resumes').insert(row);
    if (error) {
      fail(`resume insert failed (${r.filename}): ${error.message}`);
      continue;
    }
    resumesInserted++;

    // The API derives the S3 key as resumes/<user_id>/<filename> — move the
    // object under the new uid so the owner can still open it.
    if (s3Client && oldUid && newUid && oldUid !== newUid) {
      try {
        await s3Client.__copy(`resumes/${oldUid}/${r.filename}`, `resumes/${newUid}/${r.filename}`);
        s3Copied++;
      } catch (e) {
        warn(`S3 copy failed for ${r.filename}: ${e.message}`);
      }
    }
  }
  console.log(`   resumes inserted=${resumesInserted} s3Copied=${s3Copied}`);

  // --------------------------------------------------------------- vendors
  console.log('7. Inserting vendors…');
  let vendorsInserted = 0;
  for (const v of mongoVendors) {
    const row = {
      name: v.name,
      address: v.address || null,
      contact_person: v.contact_person || null,
      country: v.country || null,
      email: v.email || null,
      phone: v.phone || null,
      state: v.state || null,
      status: STATUS_VALUES.has(v.status) ? v.status : 'active',
      metadata: {
        created_by: v.metadata?.created_by || null,
        created_by_id: remapUid(v.metadata?.created_by_id) || null,
        last_modified_by: v.metadata?.last_modified_by || null,
      },
      created_at: iso(v.created_at),
      updated_at: iso(v.updated_at),
    };
    if (DRY_RUN) { vendorsInserted++; continue; }
    const { error } = await supabase.from('vendors').insert(row);
    if (error) fail(`vendor insert failed (${v.name}): ${error.message}`);
    else vendorsInserted++;
  }
  console.log(`   vendors inserted=${vendorsInserted}`);

  // ------------------------------------------------------- company feedback
  console.log('8. Importing company feedback (Firestore)…');
  let feedbackInserted = 0;
  for (const doc of firestoreFeedback) {
    const uid = uidMap.get(doc.firebaseUid);
    if (!uid) {
      warn(`feedback for unknown user ${doc.firebaseUid} — skipped`);
      continue;
    }
    for (const entry of doc.entries) {
      if (!entry?.company_name || !entry?.feedback) continue;
      const row = {
        user_id: uid,
        filename: doc.filename,
        filelink: doc.filelink,
        company_name: entry.company_name,
        feedback: entry.feedback,
        created_at: iso(entry.timestamp),
      };
      if (DRY_RUN) { feedbackInserted++; continue; }
      const { error } = await supabase.from('company_feedback').insert(row);
      if (error) fail(`feedback insert failed (${doc.filename}): ${error.message}`);
      else feedbackInserted++;
    }
  }
  console.log(`   feedback inserted=${feedbackInserted}`);

  // --------------------------------------------------------------- summary
  console.log('\n---------------- SUMMARY ----------------');
  console.log(`mode:            ${DRY_RUN ? 'dry-run (no writes)' : 'live'}`);
  console.log(`auth mappings:   ${uidMap.size}`);
  console.log(`users rows:      ${userIdSet.size}`);
  console.log(`jobs:            ${jobMap.size}/${mongoJobs.length}`);
  console.log(`candidates:      ${candidatesInserted}`);
  console.log(`resumes:         ${resumesInserted} (s3 copied: ${s3Copied})`);
  console.log(`vendors:         ${vendorsInserted}`);
  console.log(`feedback:        ${feedbackInserted}`);
  console.log(`warnings:        ${warnings.length}`);
  console.log(`errors:          ${errors.length}`);
  if (warnings.length) console.log(`\nWarnings:\n  - ${warnings.join('\n  - ')}`);
  if (errors.length) console.log(`\nErrors:\n  - ${errors.join('\n  - ')}`);
  console.log('');

  await mongoose.disconnect();
  process.exit(errors.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
