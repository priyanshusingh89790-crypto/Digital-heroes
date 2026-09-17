-- Profile roles are privileged data. Authenticated profile updates cannot
-- promote an account to administrator. Server-side controlled operations remain
-- possible because auth.uid() is null for service-role requests.
create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'Profile role changes must be performed through a controlled server operation';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_change_trigger on public.profiles;
create trigger prevent_profile_role_change_trigger
before update on public.profiles
for each row
execute function public.prevent_profile_role_change();

comment on column public.profiles.role is 'Privileged role; authenticated users cannot change it. Controlled server/database operations may promote administrators.';
