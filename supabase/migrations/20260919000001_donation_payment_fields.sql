-- Donation payment tracking
-- One-time donations are independent of subscriptions.

alter table public.charity_contributions
add column if not exists payment_status text
  not null default 'paid'
  check (payment_status in ('pending', 'paid', 'failed', 'cancelled'));

alter table public.charity_contributions
add column if not exists provider_reference text;

create unique index if not exists charity_contributions_provider_reference_idx
on public.charity_contributions (provider_reference)
where provider_reference is not null;

comment on column public.charity_contributions.payment_status is
'Payment lifecycle for one-time donations. Subscription contributions are treated as paid when recorded.';

comment on column public.charity_contributions.provider_reference is
'Stripe Checkout Session ID for one-time donations.';