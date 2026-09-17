-- Enhanced RLS policies for subscriptions table
-- Subscriptions are managed server-side via Stripe webhooks using service role
-- Clients should only be able to read their own subscription status

-- Drop existing policy to replace with enhanced version
drop policy if exists "users read own subscriptions" on public.subscriptions;

-- Users can read their own subscriptions
create policy "users read own subscriptions" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);

-- Prevent client-side insertion - subscriptions created via Stripe webhooks only
create policy "no insert access for subscriptions" on public.subscriptions for insert to authenticated using (false);
create policy "no insert access for subscriptions public" on public.subscriptions for insert to anon using (false);

-- Prevent client-side updates - subscriptions updated via Stripe webhooks only
create policy "no update access for subscriptions" on public.subscriptions for update to authenticated using (false);
create policy "no update access for subscriptions public" on public.subscriptions for update to anon using (false);

-- Prevent client-side deletion - subscriptions managed via Stripe lifecycle
create policy "no delete access for subscriptions" on public.subscriptions for delete to authenticated using (false);
create policy "no delete access for subscriptions public" on public.subscriptions for delete to anon using (false);
