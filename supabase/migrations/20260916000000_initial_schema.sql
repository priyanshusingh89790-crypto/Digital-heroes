-- Digital Heroes initial schema. Apply with `supabase db push`.
-- Monetary values are stored as integer minor units (GBP pence).

create extension if not exists pgcrypto;

create type public.app_role as enum ('subscriber', 'admin');
create type public.subscription_status as enum ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'expired');
create type public.draw_type as enum ('random', 'algorithmic');
create type public.draw_status as enum ('draft', 'simulated', 'published', 'archived', 'cancelled');
create type public.winner_verification_status as enum ('pending', 'submitted', 'under_review', 'approved', 'rejected', 'paid');
create type public.payout_status as enum ('pending', 'processing', 'paid', 'failed', 'cancelled');

create table public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text not null check (char_length(short_description) <= 280),
  description text not null,
  website_url text,
  image_path text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index charities_one_featured_idx on public.charities (is_featured) where is_featured;
create index charities_active_idx on public.charities (is_active, name);

create table public.charity_events (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  registration_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index charity_events_upcoming_idx on public.charity_events (charity_id, starts_at);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_path text,
  role public.app_role not null default 'subscriber',
  preferred_charity_id uuid references public.charities(id) on delete set null,
  charity_contribution_percentage numeric(5,2) not null default 10.00 check (charity_contribution_percentage >= 10 and charity_contribution_percentage <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_charity_idx on public.profiles (preferred_charity_id);
create index profiles_role_idx on public.profiles (role);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  stripe_price_id text not null,
  plan_interval text not null check (plan_interval in ('month', 'year')),
  status public.subscription_status not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  currency char(3) not null default 'GBP',
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, stripe_subscription_id),
  check (current_period_end is null or current_period_start is null or current_period_end >= current_period_start)
);
create index subscriptions_user_status_idx on public.subscriptions (user_id, status, current_period_end desc);
create index subscriptions_stripe_customer_idx on public.subscriptions (stripe_customer_id);

create table public.charity_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  charity_id uuid not null references public.charities(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  percentage numeric(5,2) not null check (percentage >= 10 and percentage <= 100),
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'GBP',
  source text not null check (source in ('subscription', 'donation')),
  created_at timestamptz not null default now()
);
create index charity_contributions_user_idx on public.charity_contributions (user_id, created_at desc);
create index charity_contributions_charity_idx on public.charity_contributions (charity_id, created_at desc);

create table public.golf_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score_date date not null check (score_date <= current_date),
  stableford_score smallint not null check (stableford_score between 1 and 45),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, score_date)
);
create index golf_scores_user_recent_idx on public.golf_scores (user_id, score_date desc);

create table public.draws (
  id uuid primary key default gen_random_uuid(),
  draw_month date not null unique check (draw_month = date_trunc('month', draw_month)::date),
  type public.draw_type not null,
  status public.draw_status not null default 'draft',
  number_range_min smallint not null default 1,
  number_range_max smallint not null default 45,
  numbers smallint[] check (numbers is null or (cardinality(numbers) = 5 and numbers <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45]::smallint[])),
  algorithm_version text,
  generation_audit jsonb not null default '{}'::jsonb,
  simulated_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (number_range_min >= 1 and number_range_max > number_range_min),
  check ((status in ('draft', 'cancelled') and published_at is null) or status not in ('draft', 'cancelled')),
  check (status <> 'published' or (published_at is not null and numbers is not null))
);
create index draws_status_month_idx on public.draws (status, draw_month desc);

create table public.prize_pools (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null unique references public.draws(id) on delete cascade,
  currency char(3) not null default 'GBP',
  active_subscriber_count integer not null check (active_subscriber_count >= 0),
  subscription_contribution_minor bigint not null check (subscription_contribution_minor >= 0),
  current_contribution_minor bigint not null check (current_contribution_minor >= 0),
  jackpot_rollover_in_minor bigint not null default 0 check (jackpot_rollover_in_minor >= 0),
  five_match_pool_minor bigint not null check (five_match_pool_minor >= 0),
  four_match_pool_minor bigint not null check (four_match_pool_minor >= 0),
  three_match_pool_minor bigint not null check (three_match_pool_minor >= 0),
  jackpot_rollover_out_minor bigint not null default 0 check (jackpot_rollover_out_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (five_match_pool_minor >= jackpot_rollover_in_minor)
);

create table public.draw_entries (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  selected_numbers smallint[] not null check (cardinality(selected_numbers) = 5 and selected_numbers <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45]::smallint[]),
  score_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (draw_id, user_id)
);
create index draw_entries_draw_idx on public.draw_entries (draw_id);
create index draw_entries_user_idx on public.draw_entries (user_id, created_at desc);

create table public.draw_results (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  entry_id uuid not null unique references public.draw_entries(id) on delete cascade,
  matched_count smallint not null check (matched_count between 0 and 5),
  matched_numbers smallint[] not null default '{}',
  created_at timestamptz not null default now()
);
create index draw_results_draw_match_idx on public.draw_results (draw_id, matched_count desc);

create table public.winners (
  id uuid primary key default gen_random_uuid(),
  draw_result_id uuid not null unique references public.draw_results(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  tier smallint not null check (tier in (3, 4, 5)),
  prize_amount_minor bigint not null check (prize_amount_minor >= 0),
  currency char(3) not null default 'GBP',
  verification_status public.winner_verification_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((verification_status <> 'rejected') or rejection_reason is not null),
  check ((verification_status not in ('approved', 'paid')) or reviewed_at is not null)
);
create index winners_user_idx on public.winners (user_id, created_at desc);
create index winners_verification_idx on public.winners (verification_status, created_at);

create table public.winner_proofs (
  id uuid primary key default gen_random_uuid(),
  winner_id uuid not null references public.winners(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);
create index winner_proofs_winner_idx on public.winner_proofs (winner_id);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  winner_id uuid not null unique references public.winners(id) on delete restrict,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'GBP',
  status public.payout_status not null default 'pending',
  provider_reference text unique,
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'paid') or paid_at is not null)
);
create index payouts_status_idx on public.payouts (status, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''), case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin'::public.app_role else 'subscriber'::public.app_role end);
  return new;
end;
$$;

create trigger charities_updated_at before update on public.charities for each row execute function public.set_updated_at();
create trigger charity_events_updated_at before update on public.charity_events for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger golf_scores_updated_at before update on public.golf_scores for each row execute function public.set_updated_at();
create trigger draws_updated_at before update on public.draws for each row execute function public.set_updated_at();
create trigger prize_pools_updated_at before update on public.prize_pools for each row execute function public.set_updated_at();
create trigger winners_updated_at before update on public.winners for each row execute function public.set_updated_at();
create trigger payouts_updated_at before update on public.payouts for each row execute function public.set_updated_at();
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.charities enable row level security;
alter table public.charity_events enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.charity_contributions enable row level security;
alter table public.golf_scores enable row level security;
alter table public.draws enable row level security;
alter table public.prize_pools enable row level security;
alter table public.draw_entries enable row level security;
alter table public.draw_results enable row level security;
alter table public.winners enable row level security;
alter table public.winner_proofs enable row level security;
alter table public.payouts enable row level security;

create policy "public can read active charities" on public.charities for select using (is_active);
create policy "public can read active charity events" on public.charity_events for select using (exists (select 1 from public.charities c where c.id = charity_id and c.is_active));
create policy "users read their profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "users update their profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "users read own subscriptions" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "users read own contributions" on public.charity_contributions for select to authenticated using ((select auth.uid()) = user_id);
create policy "users read own scores" on public.golf_scores for select to authenticated using ((select auth.uid()) = user_id);
create policy "users insert own scores" on public.golf_scores for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update own scores" on public.golf_scores for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users delete own scores" on public.golf_scores for delete to authenticated using ((select auth.uid()) = user_id);
create policy "public can read published draws" on public.draws for select using (status = 'published');
create policy "public can read published prize pools" on public.prize_pools for select using (exists (select 1 from public.draws d where d.id = draw_id and d.status = 'published'));
create policy "users read own draw entries" on public.draw_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "users read own results" on public.draw_results for select to authenticated using (exists (select 1 from public.draw_entries e where e.id = entry_id and e.user_id = (select auth.uid())));
create policy "users read own winners" on public.winners for select to authenticated using ((select auth.uid()) = user_id);
create policy "users read own winner proofs" on public.winner_proofs for select to authenticated using (exists (select 1 from public.winners w where w.id = winner_id and w.user_id = (select auth.uid())));
create policy "users read own payouts" on public.payouts for select to authenticated using (exists (select 1 from public.winners w where w.id = winner_id and w.user_id = (select auth.uid())));

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_path, preferred_charity_id, charity_contribution_percentage) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('charity-media', 'charity-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']), ('winner-proofs', 'winner-proofs', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "authenticated users upload own winner proofs" on storage.objects for insert to authenticated with check (bucket_id = 'winner-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users read own winner proofs" on storage.objects for select to authenticated using (bucket_id = 'winner-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete own winner proofs" on storage.objects for delete to authenticated using (bucket_id = 'winner-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
