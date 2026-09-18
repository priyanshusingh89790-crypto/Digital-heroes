-- Draw lifecycle enhancements for Phase 7
-- Adds additional constraints and audit fields for draw management

-- Add check constraint to prevent republishing already published draws
alter table public.draws 
add constraint draws_prevent_republish 
check (
  status <> 'published' or 
  (status = 'published' and published_at is not null and numbers is not null)
);

-- Add index for efficient eligibility queries
create index draws_month_created_idx on public.draws (draw_month desc, created_at desc);

-- Add index for admin draw management
create index draws_admin_management_idx on public.draws (status, created_at desc) 
where status in ('draft', 'simulated');

-- Add function to get active subscriber count for a given date
create or replace function public.get_active_subscriber_count(for_date date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct user_id)
  from public.subscriptions
  where status in ('active', 'trialing')
    and current_period_start <= for_date
    and (current_period_end is null or current_period_end > for_date);
$$;

-- Add function to get average subscription amount for active subscribers
create or replace function public.get_average_subscription_amount_minor(for_date date)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(avg(unit_amount_minor)::bigint, 0)
  from public.subscriptions
  where status in ('active', 'trialing')
    and current_period_start <= for_date
    and (current_period_end is null or current_period_end > for_date);
$$;

-- Add trigger to prevent modification of published draws
create or replace function public.prevent_published_draw_modification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  if old.status = 'published' then
    if new.status not in ('published', 'archived') then
      raise exception 'A published draw can only remain published or be archived';
    end if;

    if old.draw_month is distinct from new.draw_month
      or old.type is distinct from new.type
      or old.number_range_min is distinct from new.number_range_min
      or old.number_range_max is distinct from new.number_range_max
      or old.numbers is distinct from new.numbers
      or old.simulated_at is distinct from new.simulated_at
      or old.published_at is distinct from new.published_at
      or old.algorithm_version is distinct from new.algorithm_version
      or old.generation_audit is distinct from new.generation_audit then
      raise exception 'Published draw data is immutable';
    end if;
  end if;
  return new;
end;
$;

create trigger prevent_published_draw_modification_trigger
before update on public.draws
for each row
execute function public.prevent_published_draw_modification();

-- Add comment documentation
comment on table public.draws is 'Monthly draw records with lifecycle management';
comment on table public.prize_pools is 'Prize pool calculations with rollover tracking';
comment on table public.draw_entries is 'User entries for draws with score snapshots';
comment on table public.draw_results is 'Match results for each draw entry';
comment on table public.winners is 'Winner records with verification status';

comment on column public.draws.status is 'Draft -> Simulated -> Published -> Archived. Published draws are immutable.';
comment on column public.prize_pools.jackpot_rollover_in_minor is 'Previous unclaimed jackpot rolled into this draw';
comment on column public.prize_pools.jackpot_rollover_out_minor is 'Unclaimed jackpot from this draw rolling to next';
comment on column public.draw_entries.score_snapshot is 'JSON array of user''s golf scores at entry time';
