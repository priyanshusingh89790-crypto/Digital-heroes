import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/authorization";
import type { DrawConfig, DrawSimulation, DrawStatus, DrawType, PrizePoolConfig, AlgorithmicConfig } from "./types";
import { generateDraw, simulateDraw as engineSimulateDraw, isValidStateTransition, canPublishDraw, canModifyDraw, validateDrawConfig, validatePrizeConfig, prepareAlgorithmicConfig } from "./draw-engine";
import { calculateMatches, groupMatchesByTier } from "./matching";
import { calculatePrizePool, calculateWinners } from "./prize-calculator";

const createDrawSchema = z.object({ draw_month: z.string().regex(/^\d{4}-\d{2}$/, "Invalid month format (YYYY-MM)"), type: z.enum(["random", "algorithmic"]), number_range_min: z.number().int().min(1).max(44), number_range_max: z.number().int().min(2).max(45) });
const simulateDrawSchema = z.object({ draw_id: z.string().uuid(), seed: z.string().optional() });
const publishDrawSchema = z.object({ draw_id: z.string().uuid() });
const updateDrawSchema = z.object({ draw_id: z.string().uuid(), type: z.enum(["random", "algorithmic"]).optional(), number_range_min: z.number().int().min(1).max(44).optional(), number_range_max: z.number().int().min(2).max(45).optional() });

function monthBounds(drawMonth: string) {
  const start = new Date(`${drawMonth}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

async function getEligibleSubscriptions(admin: ReturnType<typeof createAdminClient>, drawMonth: string) {
  const { start, end } = monthBounds(drawMonth);
  const { data, error } = await admin.from("subscriptions").select("user_id, unit_amount_minor, plan_interval, current_period_start, current_period_end").eq("status", "active").lt("current_period_start", end.toISOString()).gt("current_period_end", start.toISOString());
  if (error) throw new Error(`Failed to fetch subscriptions: ${error.message}`);
  return data ?? [];
}

function subscriptionPoolAmount(subscriptions: Array<{ unit_amount_minor: number }>) {
  // The PRD specifies a fixed portion of subscription fees but does not define the percentage.
  // Phase 7 documents 50% as the implementation assumption. Sum each eligible subscription
  // individually so mixed monthly/yearly plans are not distorted by an average amount.
  return subscriptions.reduce((sum, subscription) => sum + Number(subscription.unit_amount_minor || 0), 0);
}

export async function createDraw(input: z.infer<typeof createDrawSchema>) {
  const { profile } = await requireAdmin();
  const admin = createAdminClient();
  const validated = createDrawSchema.parse(input);
  const monthDate = new Date(`${validated.draw_month}-01T00:00:00.000Z`);
  if (isNaN(monthDate.getTime())) throw new Error("Invalid month format");
  const { data: existingDraw } = await admin.from("draws").select("id, status").eq("draw_month", monthDate.toISOString().split("T")[0]).maybeSingle();
  if (existingDraw) {
    if (existingDraw.status === "published") throw new Error("A published draw already exists for this month");
    if (existingDraw.status !== "cancelled") throw new Error(`A draw with status '${existingDraw.status}' already exists for this month`);
  }
  const config: DrawConfig = { type: validated.type, numberRange: { min: validated.number_range_min, max: validated.number_range_max }, count: 5 };
  validateDrawConfig(config);
  const { data: draw, error } = await admin.from("draws").insert({ draw_month: monthDate.toISOString().split("T")[0], type: validated.type, status: "draft", number_range_min: validated.number_range_min, number_range_max: validated.number_range_max, created_by: profile.id, generation_audit: { created_by: profile.id, created_at: new Date().toISOString() } }).select().single();
  if (error) throw new Error(`Failed to create draw: ${error.message}`);
  return draw;
}

async function buildSimulation(draw: any, seed?: string): Promise<DrawSimulation> {
  const admin = createAdminClient();
  const subscriptions = await getEligibleSubscriptions(admin, draw.draw_month);
  const eligibleUserIds = [...new Set(subscriptions.map((s: any) => s.user_id))];
  const { data: golfScores, error: scoresError } = await admin.from("golf_scores").select("user_id, stableford_score, score_date").in("user_id", eligibleUserIds).order("score_date", { ascending: false });
  if (scoresError) throw new Error(`Failed to fetch golf scores: ${scoresError.message}`);
  const userScores = new Map<string, number[]>();
  for (const score of golfScores || []) { if (!userScores.has(score.user_id)) userScores.set(score.user_id, []); const scores = userScores.get(score.user_id)!; if (scores.length < 5) scores.push(score.stableford_score); }
  const entries = Array.from(userScores.entries()).map(([userId, scores]) => ({ userId, selectedNumbers: scores.length === 5 ? scores : [], scoreSnapshot: scores })).filter((entry) => entry.selectedNumbers.length === 5);
  const config: DrawConfig = { type: draw.type as DrawType, numberRange: { min: draw.number_range_min, max: draw.number_range_max }, count: 5 };
  let drawConfig: DrawConfig | AlgorithmicConfig = config;
  if (draw.type === "algorithmic") drawConfig = prepareAlgorithmicConfig(Array.from(userScores.values()), { min: draw.number_range_min, max: draw.number_range_max }, 5, seed);
  const prizeConfig: PrizePoolConfig = { currency: "GBP", contributionPercentage: 50, activeSubscriberCount: subscriptions.length, subscriptionAmountMinor: subscriptionPoolAmount(subscriptions), jackpotRolloverInMinor: 0 };
  validatePrizeConfig(prizeConfig);
  return engineSimulateDraw(drawConfig, entries, prizeConfig, seed);
}

export async function simulateDraw(input: z.infer<typeof simulateDrawSchema>): Promise<DrawSimulation> {
  const { profile } = await requireAdmin();
  const admin = createAdminClient();
  const validated = simulateDrawSchema.parse(input);
  const { data: draw, error: drawError } = await admin.from("draws").select("*").eq("id", validated.draw_id).single();
  if (drawError || !draw) throw new Error("Draw not found");
  if (draw.status !== "draft" && draw.status !== "simulated") throw new Error(`Cannot simulate draw with status '${draw.status}'`);
  const simulation = await buildSimulation(draw, validated.seed);
  const now = new Date().toISOString();
  const { error } = await admin.from("draws").update({ status: "simulated", numbers: simulation.drawResult.numbers, simulated_at: now, generation_audit: { ...draw.generation_audit, simulated_at: now, simulated_by: profile.id, simulation_result: { draw_numbers: simulation.drawResult.numbers, eligible_participants: simulation.eligibleParticipants, total_pool: simulation.prizePool.totalPoolMinor, winners_count: simulation.winners.length } } }).eq("id", validated.draw_id);
  if (error) throw new Error(`Failed to save simulation: ${error.message}`);
  return simulation;
}

export async function publishDraw(input: z.infer<typeof publishDrawSchema>) {
  const { profile } = await requireAdmin();
  const admin = createAdminClient();
  const validated = publishDrawSchema.parse(input);
  const { data: draw, error: drawError } = await admin.from("draws").select("*").eq("id", validated.draw_id).single();
  if (drawError || !draw) throw new Error("Draw not found");
  if (!canPublishDraw(draw.status as DrawStatus, draw.numbers !== null)) throw new Error(`Cannot publish draw with status '${draw.status}'`);
  const previousMonth = new Date(`${draw.draw_month}T00:00:00.000Z`); previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const { data: previousDraw } = await admin.from("draws").select("id").eq("draw_month", previousMonth.toISOString().split("T")[0]).eq("status", "published").maybeSingle();
  let jackpotRolloverIn = 0;
  if (previousDraw) { const { data: previousPrizePool } = await admin.from("prize_pools").select("jackpot_rollover_out_minor").eq("draw_id", previousDraw.id).maybeSingle(); jackpotRolloverIn = Number(previousPrizePool?.jackpot_rollover_out_minor || 0); }
  let finalNumbers = draw.numbers as number[] | null;
  if (!finalNumbers) { const config: DrawConfig = { type: draw.type as DrawType, numberRange: { min: draw.number_range_min, max: draw.number_range_max }, count: 5 }; finalNumbers = generateDraw(config).numbers; }
  const subscriptions = await getEligibleSubscriptions(admin, draw.draw_month);
  const eligibleUserIds = [...new Set(subscriptions.map((s: any) => s.user_id))];
  const { data: golfScores, error: scoresError } = await admin.from("golf_scores").select("user_id, stableford_score, score_date").in("user_id", eligibleUserIds).order("score_date", { ascending: false });
  if (scoresError) throw new Error(`Failed to fetch golf scores: ${scoresError.message}`);
  const userScores = new Map<string, number[]>();
  for (const score of golfScores || []) { if (!userScores.has(score.user_id)) userScores.set(score.user_id, []); const scores = userScores.get(score.user_id)!; if (scores.length < 5) scores.push(score.stableford_score); }
  const entries: Array<{ id: string; userId: string; selectedNumbers: number[] }> = [];
  for (const [userId, scores] of userScores) {
    if (scores.length !== 5) continue;
    const { data: entry, error } = await admin.from("draw_entries").upsert({ draw_id: validated.draw_id, user_id: userId, selected_numbers: scores, score_snapshot: scores }, { onConflict: "draw_id,user_id" }).select().single();
    if (error) throw new Error(`Failed to create draw entry: ${error.message}`);
    entries.push({ id: entry.id, userId, selectedNumbers: scores });
  }
  const matches = calculateMatches(finalNumbers, entries);
  const tierGroups = groupMatchesByTier(matches);
  const prizeConfig: PrizePoolConfig = { currency: "GBP", contributionPercentage: 50, activeSubscriberCount: subscriptions.length, subscriptionAmountMinor: subscriptionPoolAmount(subscriptions), jackpotRolloverInMinor: jackpotRolloverIn };
  const prizePool = calculatePrizePool(prizeConfig);
  const { winners, updatedPrizePool } = calculateWinners(prizePool, tierGroups);
  const { data: prizePoolRecord, error: poolError } = await admin.from("prize_pools").upsert({ draw_id: validated.draw_id, currency: prizeConfig.currency, active_subscriber_count: prizeConfig.activeSubscriberCount, subscription_contribution_minor: prizePool.subscriptionContributionMinor, current_contribution_minor: prizePool.subscriptionContributionMinor, jackpot_rollover_in_minor: jackpotRolloverIn, five_match_pool_minor: prizePool.fiveMatchPoolMinor, four_match_pool_minor: prizePool.fourMatchPoolMinor, three_match_pool_minor: prizePool.threeMatchPoolMinor, jackpot_rollover_out_minor: updatedPrizePool.jackpotRolloverOutMinor }, { onConflict: "draw_id" }).select().single();
  if (poolError) throw new Error(`Failed to create prize pool: ${poolError.message}`);
  for (const match of matches) { const { data: result, error } = await admin.from("draw_results").upsert({ draw_id: validated.draw_id, entry_id: match.entryId, matched_count: match.matchedCount, matched_numbers: match.matchedNumbers }, { onConflict: "entry_id" }).select().single(); if (error) throw new Error(`Failed to create draw result: ${error.message}`); if (result) { const winner = winners.find((w) => w.userId === match.userId); if (winner) { const { error: winnerError } = await admin.from("winners").upsert({ draw_result_id: result.id, user_id: winner.userId, tier: winner.tier, prize_amount_minor: winner.prizeAmountMinor, currency: winner.currency, verification_status: "pending" }, { onConflict: "draw_result_id" }); if (winnerError) throw new Error(`Failed to create winner: ${winnerError.message}`); } } }
  const now = new Date().toISOString();
  const { error: updateError } = await admin.from("draws").update({ status: "published", numbers: finalNumbers, published_at: now, algorithm_version: draw.type === "random" ? "random-v1" : "algorithmic-v1", generation_audit: { ...draw.generation_audit, published_at: now, published_by: profile.id } }).eq("id", validated.draw_id);
  if (updateError) throw new Error(`Failed to publish draw: ${updateError.message}`);
  return { draw_id: validated.draw_id, numbers: finalNumbers, prize_pool: prizePoolRecord, winners_count: winners.length };
}

export async function getDraw(drawId: string) { const admin = createAdminClient(); const { data: draw, error } = await admin.from("draws").select("*").eq("id", drawId).single(); if (error || !draw) throw new Error("Draw not found"); return draw; }
export async function getDrawHistory(limit: number = 12) { await requireAdmin(); const admin = createAdminClient(); const { data: draws, error } = await admin.from("draws").select("*").order("draw_month", { ascending: false }).limit(limit); if (error) throw new Error(`Failed to fetch draw history: ${error.message}`); return draws || []; }
export async function updateDraw(input: z.infer<typeof updateDrawSchema>) { await requireAdmin(); const admin = createAdminClient(); const validated = updateDrawSchema.parse(input); const { data: draw, error: fetchError } = await admin.from("draws").select("*").eq("id", validated.draw_id).single(); if (fetchError || !draw) throw new Error("Draw not found"); if (!canModifyDraw(draw.status as DrawStatus)) throw new Error(`Cannot modify draw with status '${draw.status}'`); const config: DrawConfig = { type: (validated.type || draw.type) as DrawType, numberRange: { min: validated.number_range_min ?? draw.number_range_min, max: validated.number_range_max ?? draw.number_range_max }, count: 5 }; validateDrawConfig(config); const updateData: Record<string, unknown> = {}; if (validated.type !== undefined) updateData.type = validated.type; if (validated.number_range_min !== undefined) updateData.number_range_min = validated.number_range_min; if (validated.number_range_max !== undefined) updateData.number_range_max = validated.number_range_max; const { data: updatedDraw, error: updateError } = await admin.from("draws").update(updateData).eq("id", validated.draw_id).select().single(); if (updateError) throw new Error(`Failed to update draw: ${updateError.message}`); return updatedDraw; }
export async function cancelDraw(drawId: string) { const { profile } = await requireAdmin(); const admin = createAdminClient(); const { data: draw, error: fetchError } = await admin.from("draws").select("*").eq("id", drawId).single(); if (fetchError || !draw) throw new Error("Draw not found"); if (!isValidStateTransition(draw.status as DrawStatus, "cancelled")) throw new Error(`Cannot cancel draw with status '${draw.status}'`); const { error: updateError } = await admin.from("draws").update({ status: "cancelled", generation_audit: { ...draw.generation_audit, cancelled_at: new Date().toISOString(), cancelled_by: profile.id } }).eq("id", drawId); if (updateError) throw new Error(`Failed to cancel draw: ${updateError.message}`); return { success: true }; }
