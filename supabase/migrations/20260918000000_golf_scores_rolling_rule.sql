-- Database function to enforce the 5-score rolling rule
-- This ensures only the 5 most recent scores by score_date are retained per user
-- The function is called automatically after insert/update operations

create or replace function public.enforce_five_score_rolling_rule()
returns trigger as $$
declare
  user_uuid uuid;
  score_count int;
  oldest_score_to_delete uuid;
begin
  user_uuid := NEW.user_id;
  
  -- Count scores for this user
  select count(*) into score_count
  from public.golf_scores
  where user_id = user_uuid;
  
  -- If more than 5 scores, remove the oldest by score_date
  if score_count > 5 then
    -- Find the oldest score by score_date (not created_at)
    select id into oldest_score_to_delete
    from public.golf_scores
    where user_id = user_uuid
    order by score_date asc
    limit 1;
    
    -- Delete the oldest score
    if oldest_score_to_delete is not null then
      delete from public.golf_scores
      where id = oldest_score_to_delete;
    end if;
  end if;
  
  return NEW;
end;
$$ language plpgsql security definer set search_path = '';

-- Create trigger to call the function after insert and update
create trigger enforce_rolling_rule_after_insert
after insert on public.golf_scores
for each row
execute function public.enforce_five_score_rolling_rule();

create trigger enforce_rolling_rule_after_update
after update on public.golf_scores
for each row
execute function public.enforce_five_score_rolling_rule();
