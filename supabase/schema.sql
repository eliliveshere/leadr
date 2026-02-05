-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- 1) leads
create table leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  business_name text not null,
  category text,
  city text,
  phone text,
  email text,
  website text,
  google_maps_url text,
  rating numeric,
  review_count int,
  has_opt_in boolean default false,
  status text not null default 'new',
  next_action text,
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  website_url text,
  scan_status text not null default 'not_scanned',
  scan_score int,
  scan_reasons text[] default '{}'::text[],
  scan_missing text[] default '{}'::text[],
  scan_recommended_angle text,
  scan_confidence text,
  scan_summary text,
  scan_findings_json jsonb default '{}'::jsonb,
  scan_last_at timestamptz,
  scan_last_at timestamptz,
  scan_error text,
  notes text,
  google_place_id text,
  google_place_link text,
  google_business_id text,
  google_is_claimed boolean,
  google_verified boolean,
  google_is_permanently_closed boolean,
  google_is_temporarily_closed boolean,
  google_full_address text,
  google_state text,
  google_city_raw text,
  google_latitude numeric,
  google_longitude numeric,
  google_timezone text,
  google_types text[] default '{}'::text[],
  google_working_hours jsonb default '{}'::jsonb,
  google_price_level text,
  google_scraped_at timestamptz,
  google_photos jsonb default '[]'::jsonb,
  source text not null default 'manual',
  source_raw jsonb default '{}'::jsonb,
  google_hours_present boolean default false,
  google_hours_text text
);

-- 2) outreach_messages
create table outreach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  lead_id uuid not null references leads(id) on delete cascade,
  channel text not null,
  style text not null,
  subject text,
  body text not null,
  variant text not null,
  is_approved boolean default false,
  created_at timestamptz default now()
);

-- 3) outreach_sends
create table outreach_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  lead_id uuid not null references leads(id) on delete cascade,
  channel text not null,
  provider text not null,
  provider_message_id text,
  to_value text not null,
  from_value text,
  subject text,
  body text not null,
  status text not null default 'sent',
  error text,
  created_at timestamptz default now()
);

-- 4) inbound_messages
create table inbound_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id), 
  lead_id uuid references leads(id) on delete set null,
  from_number text not null,
  to_number text not null,
  body text not null,
  provider text not null default 'twilio',
  provider_message_id text,
  created_at timestamptz default now()
);

-- 5) clients
create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  lead_id uuid not null references leads(id),
  package_tier text not null default 'starter',
  payment_status text not null default 'unpaid',
  onboarding_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 6) deliver_packs
create table deliver_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  client_id uuid not null references clients(id) on delete cascade,
  pack_json jsonb not null,
  created_at timestamptz default now()
);

-- 7) qualification_jobs
create table qualification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  created_at timestamptz default now(),
  status text not null default 'running',
  total int not null,
  completed int not null default 0,
  failed int not null default 0
);

-- 8) qualification_job_items
create table qualification_job_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  job_id uuid not null references qualification_jobs(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  status text not null default 'queued',
  error text,
  created_at timestamptz default now()
);

-- INDEXES
create index leads_user_id_status_idx on leads(user_id, status);
create index leads_user_id_next_action_at_idx on leads(user_id, next_action_at);
create index outreach_sends_user_id_created_at_idx on outreach_sends(user_id, created_at);
create index inbound_messages_user_id_created_at_idx on inbound_messages(user_id, created_at);
create index qualification_jobs_user_id_created_at_idx on qualification_jobs(user_id, created_at);
create index qualification_job_items_job_id_idx on qualification_job_items(job_id);
create index qualification_job_items_lead_id_idx on qualification_job_items(lead_id);

-- RLS POLICIES
alter table leads enable row level security;
alter table outreach_messages enable row level security;
alter table outreach_sends enable row level security;
alter table inbound_messages enable row level security;
alter table clients enable row level security;
alter table deliver_packs enable row level security;
alter table qualification_jobs enable row level security;
alter table qualification_job_items enable row level security;

-- Leads Policies
create policy "Users can view their own leads" on leads for select using (auth.uid() = user_id);
create policy "Users can insert their own leads" on leads for insert with check (auth.uid() = user_id);
create policy "Users can update their own leads" on leads for update using (auth.uid() = user_id);
create policy "Users can delete their own leads" on leads for delete using (auth.uid() = user_id);

-- Outreach Messages Policies
create policy "Users can view their own outreach messages" on outreach_messages for select using (auth.uid() = user_id);
create policy "Users can insert their own outreach messages" on outreach_messages for insert with check (auth.uid() = user_id);
create policy "Users can update their own outreach messages" on outreach_messages for update using (auth.uid() = user_id);
create policy "Users can delete their own outreach messages" on outreach_messages for delete using (auth.uid() = user_id);

-- Outreach Sends Policies
create policy "Users can view their own outreach sends" on outreach_sends for select using (auth.uid() = user_id);
create policy "Users can insert their own outreach sends" on outreach_sends for insert with check (auth.uid() = user_id);
create policy "Users can update their own outreach sends" on outreach_sends for update using (auth.uid() = user_id);
create policy "Users can delete their own outreach sends" on outreach_sends for delete using (auth.uid() = user_id);

-- Inbound Messages Policies
create policy "Users can view their own inbound messages" on inbound_messages for select using (auth.uid() = user_id);
create policy "Users can insert their own inbound messages" on inbound_messages for insert with check (auth.uid() = user_id);
create policy "Users can update their own inbound messages" on inbound_messages for update using (auth.uid() = user_id);
create policy "Users can delete their own inbound messages" on inbound_messages for delete using (auth.uid() = user_id);

-- Clients Policies
create policy "Users can view their own clients" on clients for select using (auth.uid() = user_id);
create policy "Users can insert their own clients" on clients for insert with check (auth.uid() = user_id);
create policy "Users can update their own clients" on clients for update using (auth.uid() = user_id);
create policy "Users can delete their own clients" on clients for delete using (auth.uid() = user_id);

-- Deliver Packs Policies
create policy "Users can view their own deliver packs" on deliver_packs for select using (auth.uid() = user_id);
create policy "Users can insert their own deliver packs" on deliver_packs for insert with check (auth.uid() = user_id);
create policy "Users can update their own deliver packs" on deliver_packs for update using (auth.uid() = user_id);
create policy "Users can delete their own deliver packs" on deliver_packs for delete using (auth.uid() = user_id);

-- Qualification Jobs Policies
create policy "Users can view their own qualification jobs" on qualification_jobs for select using (auth.uid() = user_id);
create policy "Users can insert their own qualification jobs" on qualification_jobs for insert with check (auth.uid() = user_id);
create policy "Users can update their own qualification jobs" on qualification_jobs for update using (auth.uid() = user_id);
create policy "Users can delete their own qualification jobs" on qualification_jobs for delete using (auth.uid() = user_id);

-- Qualification Items Policies
create policy "Users can view their own qualification items" on qualification_job_items for select using (auth.uid() = user_id);
create policy "Users can insert their own qualification items" on qualification_job_items for insert with check (auth.uid() = user_id);
create policy "Users can update their own qualification items" on qualification_job_items for update using (auth.uid() = user_id);
create policy "Users can delete their own qualification items" on qualification_job_items for delete using (auth.uid() = user_id);
