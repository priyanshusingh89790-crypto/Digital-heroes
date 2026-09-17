-- Allow a subscriber to record proof metadata for their own pending/submitted winner.
-- Users still cannot update winner verification, payout, or prize fields.

create policy "users insert own pending winner proofs"
on public.winner_proofs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.winners w
    where w.id = winner_id
      and w.user_id = (select auth.uid())
      and w.verification_status in ('pending', 'submitted')
  )
);

comment on policy "users insert own pending winner proofs" on public.winner_proofs is
  'Subscribers may attach proof files for their own unverified winnings. Approval remains admin-only.';
