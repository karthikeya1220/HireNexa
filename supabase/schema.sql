-- HireNexa initial Supabase schema (replaces MongoDB + Firestore)
--
-- Run this ONCE in the Supabase SQL editor (or via `supabase db query`).
--
-- SETUP NOTE (Data API exposure): since 2026-04-28 new tables are NOT
-- automatically exposed to the Data (REST) API; exposure is enforced on all
-- projects from 2026-10-30. If supabase-js gets a 404/42P01 for a table,
-- enable it under Dashboard -> Settings -> Data API (expose `public` schema
-- tables to the `service_role` key). The GRANTs below already grant the
-- correct roles.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Keep updated_at honest on every UPDATE (mirrors the old mongoose timestamps)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users — canonical profile/roles store (was MongoDB `users`)
-- uid = Supabase Auth user id (TEXT so legacy ids can be remapped easily)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  uid             text primary key,
  email           text not null unique,
  name            text,
  role            text not null default 'user'
                  check (role in ('user', 'admin', 'recruiter')),
  profile_complete boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- jobs (was MongoDB `jobs`) — ownership lives in metadata jsonb, matching
-- the shapes the API has always returned.
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  company             text not null,
  location            text not null,
  description         text not null,
  employment_type     text not null,
  experience_required text not null,
  salary_range        text not null,
  status              text not null default 'active'
                      check (status in ('active', 'inactive')),
  requirements        text[] not null default '{}',
  benefits            text[] not null default '{}',
  skills_required     text[] not null default '{}',
  nice_to_have_skills text[],
  working_hours       text,
  mode_of_work        text,
  deadline            text,
  key_responsibilities text[],
  about_company       text,
  total_applications  integer not null default 0,
  shortlisted         integer not null default 0,
  rejected            integer not null default 0,
  in_progress         integer not null default 0,
  metadata            jsonb not null default '{}'::jsonb,
  assigned_recruiters text[] not null default '{}',
  candidates          jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- job_candidates (was MongoDB `jobcandidates`)
-- ---------------------------------------------------------------------------
create table if not exists public.job_candidates (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.jobs(id) on delete cascade,
  filename       text not null,
  name           text not null,
  email          text not null,
  match_analysis jsonb not null,
  analysis       jsonb not null,
  tracking       jsonb,
  user_id        text,
  user_email     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (job_id, filename)
);

-- ---------------------------------------------------------------------------
-- resumes (was MongoDB `resumes`) — S3 objects stay in AWS S3
-- ---------------------------------------------------------------------------
create table if not exists public.resumes (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  filename    text not null,
  filelink    text not null,
  file_hash   text not null,
  analysis    jsonb,
  vendor_id   text,
  vendor_name text,
  uploaded_at timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, file_hash)
);

-- ---------------------------------------------------------------------------
-- vendors (was MongoDB `vendors`)
-- ---------------------------------------------------------------------------
create table if not exists public.vendors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  address        text,
  contact_person text,
  country        text,
  email          text,
  phone          text,
  state          text,
  status         text not null default 'active'
                 check (status in ('active', 'inactive')),
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- company_feedback (was Firestore users/{uid}/resumes/feedback)
-- ---------------------------------------------------------------------------
create table if not exists public.company_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  filename    text not null,
  filelink    text,
  company_name text not null,
  feedback    text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (parity with the old Mongo indexes + hot paths)
-- ---------------------------------------------------------------------------
create index if not exists jobs_created_at_idx        on public.jobs (created_at desc);
create index if not exists jobs_created_by_idx        on public.jobs ((metadata->>'created_by_id'));
create index if not exists jobs_assigned_recruiters_idx on public.jobs using gin (assigned_recruiters);
create index if not exists job_candidates_job_id_idx  on public.job_candidates (job_id);
create index if not exists resumes_user_id_idx        on public.resumes (user_id);
create index if not exists resumes_file_hash_idx      on public.resumes (file_hash);
create index if not exists company_feedback_lookup_idx on public.company_feedback (user_id, filename);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.jobs;
create trigger set_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.job_candidates;
create trigger set_updated_at before update on public.job_candidates
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.resumes;
create trigger set_updated_at before update on public.resumes
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.vendors;
create trigger set_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access control
--
-- The browser NEVER talks to PostgREST directly: all data access goes through
-- the Express API, which authenticates the user (Supabase JWT) and queries
-- with the service_role key. service_role bypasses RLS, so the matching
-- policy for the public roles is *deny by default*:
--   * RLS enabled on every table
--   * no policies for `anon` / `authenticated` (no rows readable/writable)
--   * all table grants revoked from anon/authenticated
-- This is defense in depth: even if the anon key leaks, it reads nothing.
-- ---------------------------------------------------------------------------
alter table public.users          enable row level security;
alter table public.jobs           enable row level security;
alter table public.job_candidates enable row level security;
alter table public.resumes        enable row level security;
alter table public.vendors        enable row level security;
alter table public.company_feedback enable row level security;

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public
  revoke all on tables from anon, authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
