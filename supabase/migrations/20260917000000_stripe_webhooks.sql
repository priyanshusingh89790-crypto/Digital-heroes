create table public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(), stripe_event_id text not null unique, event_type text not null,
  payload jsonb not null, processed_at timestamptz, processing_error text, created_at timestamptz not null default now()
);
create index stripe_webhook_events_processed_idx on public.stripe_webhook_events (processed_at, created_at);
alter table public.stripe_webhook_events enable row level security;
