drop policy if exists "no insert access for subscriptions"
on public.subscriptions;

drop policy if exists "no insert access for subscriptions public"
on public.subscriptions;

create policy "no insert access for subscriptions"
on public.subscriptions
for insert
to authenticated
with check (false);

create policy "no insert access for subscriptions public"
on public.subscriptions
for insert
to anon
with check (false);

drop policy if exists "no update access for subscriptions"
on public.subscriptions;

drop policy if exists "no update access for subscriptions public"
on public.subscriptions;

create policy "no update access for subscriptions"
on public.subscriptions
for update
to authenticated
using (false)
with check (false);

create policy "no update access for subscriptions public"
on public.subscriptions
for update
to anon
using (false)
with check (false);