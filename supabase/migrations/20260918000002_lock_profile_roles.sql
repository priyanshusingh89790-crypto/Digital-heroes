-- Profile roles are privileged data. Subscriber-facing profile updates must never
-- be able to promote an account to administrator.
create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Profile role changes must be performed through a controlled database operation';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_change_trigger on public.profiles;
create trigger prevent_profile_role_change_trigger
before update on public.profiles
for each row
execute function public.prevent_profile_role_change();

comment on column public.profiles.role is 'Privileged role; immutable through normal profile updates. Promote admins through a controlled SQL/database operation.';
