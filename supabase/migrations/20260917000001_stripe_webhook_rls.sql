-- RLS policies for stripe_webhook_events table
-- This table is managed by server-side webhooks using service role, but we add
-- policies for safety and to prevent any accidental client-side access.

-- No read access for clients - this is server-only data
create policy "no read access for stripe_webhook_events" on public.stripe_webhook_events for select to authenticated using (false);
create policy "no read access for stripe_webhook_events public" on public.stripe_webhook_events for select to anon using (false);

-- No insert access for clients - webhooks use service role
create policy "no insert access for stripe_webhook_events" on public.stripe_webhook_events for insert to authenticated using (false);
create policy "no insert access for stripe_webhook_events public" on public.stripe_webhook_events for insert to anon using (false);

-- No update access for clients
create policy "no update access for stripe_webhook_events" on public.stripe_webhook_events for update to authenticated using (false);
create policy "no update access for stripe_webhook_events public" on public.stripe_webhook_events for update to anon using (false);

-- No delete access for clients
create policy "no delete access for stripe_webhook_events" on public.stripe_webhook_events for delete to authenticated using (false);
create policy "no delete access for stripe_webhook_events public" on public.stripe_webhook_events for delete to anon using (false);
