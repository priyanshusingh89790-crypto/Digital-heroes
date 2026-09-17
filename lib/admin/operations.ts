import "server-only";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/billing/plans";
import {
  createDraw,
  simulateDraw as simulateDrawOperation,
  publishDraw,
  updateDraw,
  cancelDraw,
} from "@/lib/draw/operations";

const charitySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  short_description: z.string().trim().min(1).max(280),
  description: z.string().trim().min(1).max(10000),
  website_url: z.string().url().optional().or(z.literal("")),
  image_path: z.string().trim().max(1000).optional().or(z.literal("")),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

const eventSchema = z.object({
  charity_id: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().optional().or(z.literal("")),
  location: z.string().trim().max(240).optional(),
  registration_url: z.string().url().optional().or(z.literal("")),
});

export async function getAdminOverview() {
  await requireAdmin();
  const db = createAdminClient();
  const [users, subscribers, activeSubscriptions, scores, charities, contributions, donations, pendingWinners, prizePools] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "subscriber"),
    db.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("golf_scores").select("id", { count: "exact", head: true }),
    db.from("charities").select("id", { count: "exact", head: true }).eq("is_active", true),
    db.from("charity_contributions").select("amount_minor").eq("source", "subscription"),
    db.from("charity_contributions").select("amount_minor").eq("source", "donation"),
    db.from("winners").select("id", { count: "exact", head: true }).in("verification_status", ["pending", "submitted", "under_review"]),
    db.from("prize_pools").select("current_contribution_minor, jackpot_rollover_in_minor, jackpot_rollover_out_minor"),
  ]);

  const sum = (rows: Array<{ amount_minor: number }> | null | undefined) => (rows ?? []).reduce((n, r) => n + Number(r.amount_minor || 0), 0);
  return {
    total_users: users.count ?? 0,
    subscribers: subscribers.count ?? 0,
    active_subscriptions: activeSubscriptions.count ?? 0,
    scores: scores.count ?? 0,
    active_charities: charities.count ?? 0,
    subscription_contributions_minor: sum(contributions.data),
    donation_total_minor: sum(donations.data),
    pending_winners: pendingWinners.count ?? 0,
    prize_pool_total_minor: sum(prizePools.data?.map((p) => ({ amount_minor: p.current_contribution_minor })) ?? []),
    rollover_in_minor: sum(prizePools.data?.map((p) => ({ amount_minor: p.jackpot_rollover_in_minor })) ?? []),
    rollover_out_minor: sum(prizePools.data?.map((p) => ({ amount_minor: p.jackpot_rollover_out_minor })) ?? []),
  };
}

export async function getAdminData() {
  await requireAdmin();
  const db = createAdminClient();

  const [users, subscriptions, scores, charities, events, draws, winners, pools] = await Promise.all([
    db.from("profiles").select("id, full_name, role, preferred_charity_id, charity_contribution_percentage, created_at").order("created_at", { ascending: false }).limit(100),
    db.from("subscriptions").select("id, user_id, plan_interval, status, unit_amount_minor, currency, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id").order("current_period_end", { ascending: false }).limit(100),
    db.from("golf_scores").select("id, user_id, score_date, stableford_score, created_at").order("score_date", { ascending: false }).limit(100),
    db.from("charities").select("id, name, slug, short_description, description, website_url, image_path, is_featured, is_active, created_at").order("created_at", { ascending: false }),
    db.from("charity_events").select("id, charity_id, title, description, starts_at, ends_at, location, registration_url").order("starts_at", { ascending: true }).limit(100),
    db.from("draws").select("id, draw_month, type, status, numbers, number_range_min, number_range_max, simulated_at, published_at, created_at").order("draw_month", { ascending: false }).limit(24),
    db.from("winners").select("id, user_id, draw_result_id, tier, prize_amount_minor, currency, verification_status, rejection_reason, reviewed_at, created_at, winner_proofs(id, storage_path, original_filename, mime_type, size_bytes, submitted_at), payouts(id, amount_minor, currency, status, provider_reference, paid_at)").order("created_at", { ascending: false }).limit(100),
    db.from("prize_pools").select("draw_id, currency, active_subscriber_count, subscription_contribution_minor, current_contribution_minor, jackpot_rollover_in_minor, five_match_pool_minor, four_match_pool_minor, three_match_pool_minor, jackpot_rollover_out_minor").order("created_at", { ascending: false }).limit(24),
  ]);

  return {
    users: users.data ?? [],
    subscriptions: subscriptions.data ?? [],
    scores: scores.data ?? [],
    charities: charities.data ?? [],
    events: events.data ?? [],
    draws: draws.data ?? [],
    winners: winners.data ?? [],
    pools: pools.data ?? [],
    price: formatPrice,
  };
}

export async function reviewWinner(input: { winner_id: string; decision: "approved" | "rejected"; reason?: string }) {
  const { profile } = await requireAdmin();
  const parsed = z.object({ winner_id: z.string().uuid(), decision: z.enum(["approved", "rejected"]), reason: z.string().trim().max(1000).optional() }).parse(input);
  if (parsed.decision === "rejected" && !parsed.reason) throw new Error("A rejection reason is required.");
  const db = createAdminClient();
  const { data: winner, error: fetchError } = await db.from("winners").select("id, verification_status, prize_amount_minor, currency").eq("id", parsed.winner_id).single();
  if (fetchError || !winner) throw new Error("Winner not found.");
  if (["paid", "rejected"].includes(winner.verification_status)) throw new Error("This winner can no longer be reviewed.");

  const now = new Date().toISOString();
  const { error } = await db.from("winners").update({
    verification_status: parsed.decision,
    rejection_reason: parsed.decision === "rejected" ? parsed.reason : null,
    reviewed_by: profile.id,
    reviewed_at: now,
  }).eq("id", parsed.winner_id);
  if (error) throw new Error(`Failed to review winner: ${error.message}`);

  if (parsed.decision === "approved") {
    const { error: payoutError } = await db.from("payouts").upsert({
      winner_id: parsed.winner_id,
      amount_minor: winner.prize_amount_minor,
      currency: winner.currency,
      status: "pending",
      created_by: profile.id,
    }, { onConflict: "winner_id" });
    if (payoutError) throw new Error(`Winner approved but payout creation failed: ${payoutError.message}`);
  }
  return { success: true };
}

export async function markWinnerPaid(input: { winner_id: string; provider_reference?: string }) {
  const { profile } = await requireAdmin();
  const parsed = z.object({ winner_id: z.string().uuid(), provider_reference: z.string().trim().max(200).optional() }).parse(input);
  const db = createAdminClient();
  const { data: winner } = await db.from("winners").select("id, verification_status").eq("id", parsed.winner_id).single();
  if (!winner) throw new Error("Winner not found.");
  if (winner.verification_status !== "approved") throw new Error("Only approved winners can be marked paid.");
  const now = new Date().toISOString();
  const { error: payoutError } = await db.from("payouts").update({ status: "paid", paid_at: now, provider_reference: parsed.provider_reference || null, created_by: profile.id }).eq("winner_id", parsed.winner_id);
  if (payoutError) throw new Error(`Failed to update payout: ${payoutError.message}`);
  const { error } = await db.from("winners").update({ verification_status: "paid", reviewed_by: profile.id, reviewed_at: now }).eq("id", parsed.winner_id);
  if (error) throw new Error(`Payout recorded but winner status update failed: ${error.message}`);
  return { success: true };
}

export async function upsertCharity(input: unknown) {
  await requireAdmin();
  const parsed = charitySchema.parse(input);
  const db = createAdminClient();
  if (parsed.is_featured) {
    await db.from("charities").update({ is_featured: false }).eq("is_featured", true);
  }
  const payload = { name: parsed.name, slug: parsed.slug, short_description: parsed.short_description, description: parsed.description, website_url: parsed.website_url || null, image_path: parsed.image_path || null, is_featured: parsed.is_featured, is_active: parsed.is_active };
  if (parsed.id) {
    const { error } = await db.from("charities").update(payload).eq("id", parsed.id);
    if (error) throw new Error(`Failed to update charity: ${error.message}`);
  } else {
    const { error } = await db.from("charities").insert(payload);
    if (error) throw new Error(`Failed to create charity: ${error.message}`);
  }
  return { success: true };
}

export async function setCharityActive(input: { charity_id: string; active: boolean }) {
  await requireAdmin();
  const parsed = z.object({ charity_id: z.string().uuid(), active: z.boolean() }).parse(input);
  const db = createAdminClient();
  const { error } = await db.from("charities").update({ is_active: parsed.active, ...(parsed.active ? {} : { is_featured: false }) }).eq("id", parsed.charity_id);
  if (error) throw new Error(`Failed to update charity: ${error.message}`);
  return { success: true };
}

export async function createCharityEvent(input: unknown) {
  await requireAdmin();
  const parsed = eventSchema.parse(input);
  const db = createAdminClient();
  const { error } = await db.from("charity_events").insert({ charity_id: parsed.charity_id, title: parsed.title, description: parsed.description || null, starts_at: parsed.starts_at, ends_at: parsed.ends_at || null, location: parsed.location || null, registration_url: parsed.registration_url || null });
  if (error) throw new Error(`Failed to create event: ${error.message}`);
  return { success: true };
}

export async function adminCreateDraw(input: { draw_month: string; type: "random" | "algorithmic" }) {
  return createDraw({ draw_month: input.draw_month, type: input.type, number_range_min: 1, number_range_max: 45 });
}

export async function adminSimulateDraw(drawId: string, seed?: string) {
  return simulateDrawOperation({ draw_id: z.string().uuid().parse(drawId), seed });
}

export async function adminPublishDraw(drawId: string) {
  return publishDraw({ draw_id: z.string().uuid().parse(drawId) });
}

export async function adminUpdateDraw(input: { draw_id: string; type?: "random" | "algorithmic"; number_range_min?: number; number_range_max?: number }) {
  return updateDraw(input);
}

export async function adminCancelDraw(drawId: string) {
  return cancelDraw(z.string().uuid().parse(drawId));
}
