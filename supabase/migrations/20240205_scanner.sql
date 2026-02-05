-- Add scanner columns to leads
alter table leads add column if not exists website_url text; -- use this if website is empty or needs normalization
alter table leads add column if not exists scan_status text not null default 'not_scanned';
alter table leads add column if not exists scan_score int;
alter table leads add column if not exists scan_reasons text[] default '{}'::text[];
alter table leads add column if not exists scan_missing text[] default '{}'::text[];
alter table leads add column if not exists scan_recommended_angle text;
alter table leads add column if not exists scan_confidence text;
alter table leads add column if not exists scan_summary text;
alter table leads add column if not exists scan_findings_json jsonb default '{}'::jsonb;
alter table leads add column if not exists scan_last_at timestamptz;
alter table leads add column if not exists scan_error text;

-- Create qualification_jobs
create table qualification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  created_at timestamptz default now(),
  status text not null default 'running',
  total int not null,
  completed int not null default 0,
  failed int not null default 0
);

-- Create qualification_job_items
create table qualification_job_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  job_id uuid not null references qualification_jobs(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  status text not null default 'queued',
  error text,
  created_at timestamptz default now()
);

-- Indexes
create index qualification_jobs_user_id_created_at_idx on qualification_jobs(user_id, created_at);
create index qualification_job_items_job_id_idx on qualification_job_items(job_id);
create index qualification_job_items_lead_id_idx on qualification_job_items(lead_id);

-- RLS
alter table qualification_jobs enable row level security;
alter table qualification_job_items enable row level security;

create policy "Users can view their own qualification jobs" on qualification_jobs for select using (auth.uid() = user_id);
create policy "Users can insert their own qualification jobs" on qualification_jobs for insert with check (auth.uid() = user_id);
create policy "Users can update their own qualification jobs" on qualification_jobs for update using (auth.uid() = user_id);
create policy "Users can delete their own qualification jobs" on qualification_jobs for delete using (auth.uid() = user_id);

create policy "Users can view their own qualification items" on qualification_job_items for select using (auth.uid() = user_id);
create policy "Users can insert their own qualification items" on qualification_job_items for insert with check (auth.uid() = user_id);
create policy "Users can update their own qualification items" on qualification_job_items for update using (auth.uid() = user_id);
create policy "Users can delete their own qualification items" on qualification_job_items for delete using (auth.uid() = user_id);
