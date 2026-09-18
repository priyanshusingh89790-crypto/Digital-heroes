-- Auth profile hardening and login fallback.
-- New auth users are always subscribers. Admin promotion must be controlled server-side.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'subscriber'::public.app_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Allows an authenticated user to recover a missing profile after login.
-- The WITH CHECK prevents creation of an admin profile through the client.
grant insert on public.profiles to authenticated;
drop policy if exists "users insert own subscriber profile" on public.profiles;
create policy "users insert own subscriber profile"
on public.profiles
for insert
to authenticated
with check (
  (select auth.uid()) = id
  and role = 'subscriber'::public.app_role
);
