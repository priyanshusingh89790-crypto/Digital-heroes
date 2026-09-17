-- One-time donations are only counted after Stripe confirms payment.
-- Existing subscription contribution rows remain paid by default.
alter table public.charity_contributions
  add column if not exists payment_status text not null default 'paid'
    check (payment_status in ('pending', 'paid', 'failed', 'cancelled')),
  add column if not exists provider_reference text unique;

create index if not exists charity_contributions_payment_status_idx
  on public.charity_contributions (source, payment_status, created_at desc);

comment on column public.charity_contributions.payment_status is
  'Payment lifecycle for independent donations; subscription contributions are recorded as paid.';
comment on column public.charity_contributions.provider_reference is
  'Stripe Checkout Session ID for one-time donations.';
