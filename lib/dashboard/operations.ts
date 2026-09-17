import "server-only";

import { requireSubscriber } from "@/lib/auth/authorization";
import { calculateContribution, getUserCharitySelection } from "@/lib/charity/user-charity";
import { getLatestScores } from "@/lib/golf/scores-server";
import { getCharities } from "@/lib/public/charities";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/billing/plans";
import { mapDrawParticipation, mapSubscriptionRecord, mapWinnings, mapDashboardSummary, type DrawParticipationView, type SubscriptionStatusView, type WinningsStatusView, type DashboardSummaryView } from "./mapping";

export type SubscriptionStatus = SubscriptionStatusView;
export type DrawParticipation = DrawParticipationView;
export type WinningsStatus = WinningsStatusView;
export type DashboardLoadError = string | null;
export type SubscriberDashboardData = {
  userEmail: string | null; subscription: SubscriptionStatusView; subscriptionError: DashboardLoadError;
  scores: Awaited<ReturnType<typeof getLatestScores>>; scoresError: DashboardLoadError;
  charitySelection: Awaited<ReturnType<typeof getUserCharitySelection>> | null; charityError: DashboardLoadError;
  contribution: Awaited<ReturnType<typeof calculateContribution>> | null; contributionError: DashboardLoadError;
  contributionFormatted: string | null; charities: Awaited<ReturnType<typeof getCharities>>["charities"];
  draw: DrawParticipationView; drawError: DashboardLoadError; winnings: WinningsStatusView; winningsError: DashboardLoadError; summary: DashboardSummaryView;
};

function emptyWinnings(): WinningsStatusView { return mapWinnings([]); }

export async function getSubscriptionStatus(): Promise<SubscriptionStatusView> {
  const context = await requireSubscriber(); const supabase = await createClient();
  const { data: subscription, error } = await supabase.from("subscriptions").select("status, plan_interval, unit_amount_minor, currency, current_period_start, current_period_end, cancel_at_period_end, canceled_at").eq("user_id", context.user.id).order("current_period_end", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Failed to load subscription: ${error.message}`);
  return mapSubscriptionRecord(subscription);
}

export async function getDrawParticipation(): Promise<DrawParticipationView> {
  const context = await requireSubscriber(); const supabase = await createClient();
  const { data: latestDraw, error: drawError } = await supabase.from("draws").select("id, draw_month, numbers").eq("status", "published").order("draw_month", { ascending: false }).limit(1).maybeSingle();
  if (drawError) throw new Error(`Failed to load draw: ${drawError.message}`);
  if (!latestDraw) return mapDrawParticipation({ draw: null, entry: null, result: null, winner: null });
  const { data: entry, error: entryError } = await supabase.from("draw_entries").select("id, selected_numbers").eq("draw_id", latestDraw.id).eq("user_id", context.user.id).maybeSingle();
  if (entryError) throw new Error(`Failed to load draw entry: ${entryError.message}`);
  if (!entry) return mapDrawParticipation({ draw: latestDraw, entry: null, result: null, winner: null });
  const { data: result, error: resultError } = await supabase.from("draw_results").select("id, matched_count, matched_numbers").eq("entry_id", entry.id).eq("draw_id", latestDraw.id).maybeSingle();
  if (resultError) throw new Error(`Failed to load draw result: ${resultError.message}`);
  let winner: { tier: number; verification_status: string } | null = null;
  if (result) {
    const { data: winnerRow, error: winnerError } = await supabase.from("winners").select("tier, verification_status").eq("draw_result_id", result.id).eq("user_id", context.user.id).maybeSingle();
    if (winnerError) throw new Error(`Failed to load winner status: ${winnerError.message}`); winner = winnerRow;
  }
  return mapDrawParticipation({ draw: latestDraw, entry, result: result ? { matched_count: result.matched_count, matched_numbers: result.matched_numbers } : null, winner });
}

export async function getWinningsStatus(): Promise<WinningsStatusView> {
  const context = await requireSubscriber(); const supabase = await createClient();
  const { data: winners, error } = await supabase.from("winners").select(`id, tier, prize_amount_minor, verification_status, rejection_reason, created_at, payouts (status, paid_at), winner_proofs (id, original_filename, submitted_at), draw_results (draw_id, draws (draw_month))`).eq("user_id", context.user.id).order("created_at", { ascending: false }).limit(10);
  if (error) throw new Error(`Failed to load winnings: ${error.message}`);
  if (!winners || winners.length === 0) return emptyWinnings();
  return mapWinnings(winners as unknown as Parameters<typeof mapWinnings>[0]);
}

async function settledValue<T>(promise: Promise<T>): Promise<{ value: T | null; error: DashboardLoadError }> {
  try { return { value: await promise, error: null }; } catch (error) { return { value: null, error: error instanceof Error ? error.message : "Unable to load this section." }; }
}

export async function loadSubscriberDashboard(): Promise<SubscriberDashboardData> {
  const context = await requireSubscriber();
  const [subscriptionResult, scoresResult, charityResult, contributionResult, charitiesResult, drawResult, winningsResult] = await Promise.all([
    settledValue(getSubscriptionStatus()), settledValue(getLatestScores()), settledValue(getUserCharitySelection()), settledValue(calculateContribution()), settledValue(getCharities()), settledValue(getDrawParticipation()), settledValue(getWinningsStatus()),
  ]);
  const scores = scoresResult.value ?? []; const contribution = contributionResult.value;
  const draw = drawResult.value ?? mapDrawParticipation({ draw: null, entry: null, result: null, winner: null });
  const winnings = winningsResult.value ?? emptyWinnings(); const subscription = subscriptionResult.value ?? mapSubscriptionRecord(null);
  const charitySelection = charityResult.value; const contributionFormatted = contribution ? formatPrice(contribution.amount_minor) : null;
  const summary = mapDashboardSummary({ subscription, latestScore: scores[0] ?? null, charityName: charitySelection?.charity_name ?? null, contributionPercentage: contribution?.percentage ?? charitySelection?.charity_contribution_percentage ?? null, contributionFormatted, draw, winnings });
  return { userEmail: context.user.email ?? null, subscription, subscriptionError: subscriptionResult.error, scores, scoresError: scoresResult.error, charitySelection, charityError: charityResult.error, contribution, contributionError: contributionResult.error, contributionFormatted, charities: charitiesResult.value?.charities ?? [], draw, drawError: drawResult.error, winnings, winningsError: winningsResult.error, summary };
}
