-- Add Google Scraper columns to leads
alter table leads add column if not exists google_place_id text;
alter table leads add column if not exists google_place_link text;
alter table leads add column if not exists google_business_id text;
alter table leads add column if not exists google_is_claimed boolean;
alter table leads add column if not exists google_verified boolean;
alter table leads add column if not exists google_is_permanently_closed boolean;
alter table leads add column if not exists google_is_temporarily_closed boolean;
alter table leads add column if not exists google_full_address text;
alter table leads add column if not exists google_state text;
alter table leads add column if not exists google_city_raw text;
alter table leads add column if not exists google_latitude numeric;
alter table leads add column if not exists google_longitude numeric;
alter table leads add column if not exists google_timezone text;
alter table leads add column if not exists google_types text[] default '{}'::text[];
alter table leads add column if not exists google_working_hours jsonb default '{}'::jsonb;
alter table leads add column if not exists google_price_level text;
alter table leads add column if not exists google_scraped_at timestamptz;
alter table leads add column if not exists google_photos jsonb default '[]'::jsonb;
alter table leads add column if not exists source text not null default 'manual';
alter table leads add column if not exists source_raw jsonb default '{}'::jsonb;
alter table leads add column if not exists google_hours_present boolean default false;
alter table leads add column if not exists google_hours_text text;

-- Index for source filtering
create index if not exists leads_source_idx on leads(source);
create index if not exists leads_google_place_id_idx on leads(google_place_id);
alter table leads add column if not exists notes text;
