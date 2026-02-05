-- Add enrichment columns to leads
alter table leads add column if not exists enrichment_status text default 'not_enriched'; -- not_enriched, enriching, enriched, failed
alter table leads add column if not exists enrichment_last_at timestamptz;
alter table leads add column if not exists enrichment_data jsonb default '{}'::jsonb;

-- Index for enrichment status
create index if not exists leads_enrichment_status_idx on leads(enrichment_status);
