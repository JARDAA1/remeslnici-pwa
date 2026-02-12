-- ==========================================================================
-- Řemeslníci PWA – Initial Schema Migration
-- ==========================================================================
-- This migration creates the complete database schema for the Řemeslníci app.
-- Run this in your Supabase SQL Editor or via supabase db push.
--
-- Tables: jobs, work_entries, expenses
-- Auth: Supabase auth.users (email/password)
-- Security: Row Level Security with per-user isolation
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Table: jobs
-- ---------------------------------------------------------------------------

create table public.jobs (
  id            uuid          primary key default gen_random_uuid(),
  user_id       uuid          not null references auth.users(id) on delete cascade,
  name          text          not null,
  client        text          not null,
  default_hourly_rate numeric(12,2) not null check (default_hourly_rate >= 0),
  active        boolean       not null default true,
  created_at    timestamptz   not null default now()
);

create index jobs_user_id_idx on public.jobs(user_id);

-- ---------------------------------------------------------------------------
-- Table: work_entries
-- ---------------------------------------------------------------------------

create table public.work_entries (
  id              uuid          primary key default gen_random_uuid(),
  user_id         uuid          not null references auth.users(id) on delete cascade,
  job_id          uuid          not null references public.jobs(id) on delete cascade,
  date            date          not null,
  start_time      timestamptz   not null,
  end_time        timestamptz   not null,
  hourly_rate_used numeric(14,2) not null check (hourly_rate_used >= 0),
  kilometers      numeric(14,2) not null check (kilometers >= 0),
  km_rate_used    numeric(14,2) not null check (km_rate_used >= 0),
  labor_total     numeric(14,2) not null check (labor_total >= 0),
  km_total        numeric(14,2) not null check (km_total >= 0),
  expenses_total  numeric(14,2) not null check (expenses_total >= 0),
  grand_total     numeric(14,2) not null check (grand_total >= 0),
  created_at      timestamptz   not null default now(),

  constraint work_entries_time_order check (end_time > start_time)
);

create index work_entries_user_id_idx on public.work_entries(user_id);
create index work_entries_job_id_idx  on public.work_entries(job_id);
create index work_entries_date_idx    on public.work_entries(date);

-- ---------------------------------------------------------------------------
-- Table: expenses
-- ---------------------------------------------------------------------------

create table public.expenses (
  id              uuid          primary key default gen_random_uuid(),
  user_id         uuid          not null references auth.users(id) on delete cascade,
  work_entry_id   uuid          not null references public.work_entries(id) on delete cascade,
  amount          numeric(14,2) not null check (amount >= 0),
  category        text          not null,
  created_at      timestamptz   not null default now()
);

create index expenses_user_id_idx       on public.expenses(user_id);
create index expenses_work_entry_id_idx on public.expenses(work_entry_id);

-- ==========================================================================
-- Row Level Security
-- ==========================================================================

alter table public.jobs enable row level security;
alter table public.work_entries enable row level security;
alter table public.expenses enable row level security;

-- ---------------------------------------------------------------------------
-- RLS Policies: jobs
-- ---------------------------------------------------------------------------

create policy "jobs_select" on public.jobs
  for select
  using (auth.uid() = user_id);

create policy "jobs_insert" on public.jobs
  for insert
  with check (auth.uid() = user_id);

create policy "jobs_update" on public.jobs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "jobs_delete" on public.jobs
  for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS Policies: work_entries
-- ---------------------------------------------------------------------------

create policy "work_entries_select" on public.work_entries
  for select
  using (auth.uid() = user_id);

create policy "work_entries_insert" on public.work_entries
  for insert
  with check (auth.uid() = user_id);

create policy "work_entries_update" on public.work_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "work_entries_delete" on public.work_entries
  for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS Policies: expenses
-- ---------------------------------------------------------------------------

create policy "expenses_select" on public.expenses
  for select
  using (auth.uid() = user_id);

create policy "expenses_insert" on public.expenses
  for insert
  with check (auth.uid() = user_id);

create policy "expenses_update" on public.expenses
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "expenses_delete" on public.expenses
  for delete
  using (auth.uid() = user_id);
