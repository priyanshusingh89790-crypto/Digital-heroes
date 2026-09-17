import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/authorization";
import type {
  DrawConfig,
  DrawSimulation,
  DrawStatus,
  DrawType,
  PrizePoolConfig,
  AlgorithmicConfig,
} from "./types";
import {
  generateDraw,
  simulateDraw as engineSimulateDraw,
  isValidStateTransition,
  canPublishDraw,
  canModifyDraw,
  validateDrawConfig,
  validatePrizeConfig,
  prepareAlgorithmicConfig,
} from "./draw-engine";
import { calculateMatches, groupMatchesByTier } from "./matching";
import { calculatePrizePool, calculateWinners } from "./prize-calculator";

// Validation schemas
const createDrawSchema = z.object({
  draw_month: z.string().regex(/^\d{4}-\d{2}$/, "Invalid month format (YYYY-MM)"),
  type: z.enum(["random", "algorithmic"]),
  number_range_min: z.number().int().min(1).max(44),
  number_range_max: z.number().int().min(2).max(45),
});

const simulateDrawSchema = z.object({
  draw_id: z.string().uuid(),
  seed: z.string().optional(),
});

const publishDrawSchema = z.object({
  draw_id: z.string().uuid(),
});

const updateDrawSchema = z.object({
  draw_id: z.string().uuid(),
  type: z.enum(["random", "algorithmic"]).optional(),
  number_range_min: z.number().int().min(1).max(44).optional(),
  number_range_max: z.number().int().min(2).max(45).optional(),
});

/**
 * Create a new draft draw
 * Requires admin authorization
 */
export async function createDraw(input: z.infer<typeof createDrawSchema>) {
  const { profile } = await requireAdmin();
  const admin = createAdminClient();

  const validated = createDrawSchema.parse(input);

  // Parse the month and ensure it's the first day
  const monthDate = new Date(`${validated.draw_month}-01`);
  if (isNaN(monthDate.getTime())) {
    throw new Error("Invalid month format");
  }

  // Check if a draw already exists for this month
  const { data: existingDraw } = await admin
    .from("draws")
    .select("id, status")
    .eq("draw_month", validated.draw_month)
    .maybeSingle();

  if (existingDraw) {
    if (existingDraw.status === "published") {
      throw new Error("A published draw already exists for this month");
    }
    // Allow recreation if draft/simulated/cancelled
    if (existingDraw.status !== "cancelled") {
      throw new Error(`A draw with status '${existingDraw.status}' already exists for this month`);
    }
  }

  // Validate draw configuration
  const config: DrawConfig = {
    type: validated.type,
    numberRange: {
      min: validated.number_range_min,
      max: validated.number_range_max,
    },
    count: 5,
  };
  validateDrawConfig(config);

  // Create the draw
  const { data: draw, error } = await admin
    .from("draws")
    .insert({
      draw_month: monthDate.toISOString().split("T")[0],
      type: validated.type,
      status: "draft",
      number_range_min: validated.number_range_min,
      number_range_max: validated.number_range_max,
      created_by: profile.id,
      generation_audit: {
        created_by: profile.id,
        created_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create draw: ${error.message}`);
  }

  return draw;
}

/**
 * Simulate a draw without publishing
 * Returns simulation results without mutating production data
 * Requires admin authorization
 */
export async function simulateDraw(input: z.infer<typeof simulateDrawSchema>): Promise<DrawSimulation> {
  await requireAdmin();
  const admin = createAdminClient();

  const validated = simulateDrawSchema.parse(input);

  // Fetch the draw
  const { data: draw, error: drawError } = await admin
    .from("draws")
    .select("*")
    .eq("id", validated.draw_id)
    .single();

  if (drawError || !draw) {
    throw new Error("Draw not found");
  }

  if (draw.status !== "draft" && draw.status !== "simulated") {
    throw new Error(`Cannot simulate draw with status '${draw.status}'`);
  }

  // Get eligible participants (active subscribers)
  const drawMonth = new Date(draw.draw_month);
  const { data: subscriptions, error: subError } = await admin
    .from("subscriptions")
    .select("user_id, unit_amount_minor")
    .eq("status", "active")
    .gte("current_period_start", drawMonth.toISOString())
    .lte("current_period_end", new Date(drawMonth.getFullYear(), drawMonth.getMonth() + 1, 0).toISOString());

  if (subError) {
    throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
  }

  const eligibleUserIds = subscriptions?.map((s) => s.user_id) || [];
  const avgSubscriptionAmount = subscriptions && subscriptions.length > 0
    ? Math.floor(subscriptions.reduce((sum, s) => sum + s.unit_amount_minor, 0) / subscriptions.length)
    : 0;

  // Get golf scores for eligible users
  const { data: golfScores, error: scoresError } = await admin
    .from("golf_scores")
    .select("user_id, stableford_score")
    .in("user_id", eligibleUserIds)
    .order("score_date", { ascending: false });

  if (scoresError) {
    throw new Error(`Failed to fetch golf scores: ${scoresError.message}`);
  }

  // Group scores by user (take latest 5 per user)
  const userScores = new Map<string, number[]>();
  for (const score of golfScores || []) {
    if (!userScores.has(score.user_id)) {
      userScores.set(score.user_id, []);
    }
    const scores = userScores.get(score.user_id)!;
    if (scores.length < 5) {
      scores.push(score.stableford_score);
    }
  }

  // Prepare entries for simulation
  const entries = Array.from(userScores.entries()).map(([userId, scores]) => ({
    userId,
    selectedNumbers: scores.length === 5 ? scores : [], // Use scores as draw numbers
    scoreSnapshot: scores,
  }));

  // Prepare draw configuration
  const config: DrawConfig = {
    type: draw.type as DrawType,
    numberRange: {
      min: draw.number_range_min,
      max: draw.number_range_max,
    },
    count: 5,
  };

  // For algorithmic draws, prepare score frequencies
  let drawConfig: DrawConfig | AlgorithmicConfig = config;
  if (draw.type === "algorithmic") {
    const allScores = Array.from(userScores.values());
    drawConfig = prepareAlgorithmicConfig(
      allScores,
      { min: draw.number_range_min, max: draw.number_range_max },
      5,
      validated.seed
    );
  }

  // Prepare prize pool configuration
  const prizeConfig: PrizePoolConfig = {
    currency: "GBP",
    contributionPercentage: 50, // Implementation decision
    activeSubscriberCount: eligibleUserIds.length,
    subscriptionAmountMinor: avgSubscriptionAmount,
    jackpotRolloverInMinor: 0, // Will be calculated from previous draw
  };
  validatePrizeConfig(prizeConfig);

  // Run simulation
  const simulation = engineSimulateDraw(
    drawConfig,
    entries,
    prizeConfig,
    validated.seed
  );

  // Update draw with simulation metadata (但不改变状态为published)
  await admin
    .from("draws")
    .update({
      status: "simulated",
      simulated_at: new Date().toISOString(),
      generation_audit: {
        ...draw.generation_audit,
        simulated_at: new Date().toISOString(),
        simulated_by: (await requireAdmin()).profile.id,
        simulation_result: {
          draw_numbers: simulation.drawResult.numbers,
          eligible_participants: simulation.eligibleParticipants,
          total_pool: simulation.prizePool.totalPoolMinor,
          winners_count: simulation.winners.length,
        },
      },
    })
    .eq("id", validated.draw_id);

  return simulation;
}

/**
 * Publish a draw
 * Locks the draw results and creates actual winners
 * Requires admin authorization
 */
export async function publishDraw(input: z.infer<typeof publishDrawSchema>) {
  const { profile } = await requireAdmin();
  const admin = createAdminClient();

  const validated = publishDrawSchema.parse(input);

  // Fetch the draw
  const { data: draw, error: drawError } = await admin
    .from("draws")
    .select("*")
    .eq("id", validated.draw_id)
    .single();

  if (drawError || !draw) {
    throw new Error("Draw not found");
  }

  if (!canPublishDraw(draw.status as DrawStatus, draw.numbers !== null)) {
    throw new Error(`Cannot publish draw with status '${draw.status}'`);
  }

  // Get previous month's rollover
  const previousMonth = new Date(draw.draw_month);
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  const { data: previousDraw } = await admin
    .from("draws")
    .select("id")
    .eq("draw_month", previousMonth.toISOString().split("T")[0])
    .eq("status", "published")
    .maybeSingle();

  let jackpotRolloverIn = 0;
  if (previousDraw) {
    const { data: previousPrizePool } = await admin
      .from("prize_pools")
      .select("jackpot_rollover_out_minor")
      .eq("draw_id", previousDraw.id)
      .maybeSingle();
    jackpotRolloverIn = previousPrizePool?.jackpot_rollover_out_minor || 0;
  }

  // Generate final draw numbers if not already simulated
  let finalNumbers = draw.numbers;
  if (!finalNumbers) {
    const config: DrawConfig = {
      type: draw.type as DrawType,
      numberRange: {
        min: draw.number_range_min,
        max: draw.number_range_max,
      },
      count: 5,
    };

    const result = generateDraw(config);
    finalNumbers = result.numbers;
  }

  // Get eligible participants and their scores
  const drawMonth = new Date(draw.draw_month);
  const { data: subscriptions } = await admin
    .from("subscriptions")
    .select("user_id, unit_amount_minor")
    .eq("status", "active")
    .gte("current_period_start", drawMonth.toISOString())
    .lte("current_period_end", new Date(drawMonth.getFullYear(), drawMonth.getMonth() + 1, 0).toISOString());

  const eligibleUserIds = subscriptions?.map((s) => s.user_id) || [];
  const avgSubscriptionAmount = subscriptions && subscriptions.length > 0
    ? Math.floor(subscriptions.reduce((sum, s) => sum + s.unit_amount_minor, 0) / subscriptions.length)
    : 0;

  // Get golf scores
  const { data: golfScores } = await admin
    .from("golf_scores")
    .select("user_id, stableford_score")
    .in("user_id", eligibleUserIds)
    .order("score_date", { ascending: false });

  // Group scores by user
  const userScores = new Map<string, number[]>();
  for (const score of golfScores || []) {
    if (!userScores.has(score.user_id)) {
      userScores.set(score.user_id, []);
    }
    const scores = userScores.get(score.user_id)!;
    if (scores.length < 5) {
      scores.push(score.stableford_score);
    }
  }

  // Create draw entries for eligible users
  const entryIds = new Map<string, string>();
  for (const [userId, scores] of userScores) {
    if (scores.length === 5) {
      const { data: entry } = await admin
        .from("draw_entries")
        .insert({
          draw_id: validated.draw_id,
          user_id: userId,
          selected_numbers: scores,
          score_snapshot: scores,
        })
        .select()
        .single();

      if (entry) {
        entryIds.set(userId, entry.id);
      }
    }
  }

  // Calculate matches
  const entries = Array.from(entryIds.entries()).map(([userId, entryId]) => ({
    id: entryId,
    userId,
    selectedNumbers: userScores.get(userId)!,
  }));

  const matches = calculateMatches(finalNumbers, entries);
  const tierGroups = groupMatchesByTier(matches);

  // Calculate prize pool
  const prizeConfig: PrizePoolConfig = {
    currency: "GBP",
    contributionPercentage: 50,
    activeSubscriberCount: eligibleUserIds.length,
    subscriptionAmountMinor: avgSubscriptionAmount,
    jackpotRolloverInMinor: jackpotRolloverIn,
  };

  const prizePool = calculatePrizePool(prizeConfig);
  const { winners, updatedPrizePool } = calculateWinners(prizePool, tierGroups);

  // Create prize pool record
  const { data: prizePoolRecord, error: poolError } = await admin
    .from("prize_pools")
    .insert({
      draw_id: validated.draw_id,
      currency: prizeConfig.currency,
      active_subscriber_count: prizeConfig.activeSubscriberCount,
      subscription_contribution_minor: prizeConfig.subscriptionAmountMinor,
      current_contribution_minor: prizePool.totalPoolMinor - jackpotRolloverIn,
      jackpot_rollover_in_minor: jackpotRolloverIn,
      five_match_pool_minor: prizePool.fiveMatchPoolMinor,
      four_match_pool_minor: prizePool.fourMatchPoolMinor,
      three_match_pool_minor: prizePool.threeMatchPoolMinor,
      jackpot_rollover_out_minor: updatedPrizePool.jackpotRolloverOutMinor,
    })
    .select()
    .single();

  if (poolError) {
    throw new Error(`Failed to create prize pool: ${poolError.message}`);
  }

  // Create draw results
  for (const match of matches) {
    await admin
      .from("draw_results")
      .insert({
        draw_id: validated.draw_id,
        entry_id: match.entryId,
        matched_count: match.matchedCount,
        matched_numbers: match.matchedNumbers,
      });
  }

  // Create winner records
  for (const winner of winners) {
    const entryId = entryIds.get(winner.userId);
    if (!entryId) continue;

    // Get the draw result ID
    const { data: drawResult } = await admin
      .from("draw_results")
      .select("id")
      .eq("entry_id", entryId)
      .single();

    if (drawResult) {
      await admin
        .from("winners")
        .insert({
          draw_result_id: drawResult.id,
          user_id: winner.userId,
          tier: winner.tier,
          prize_amount_minor: winner.prizeAmountMinor,
          currency: winner.currency,
          verification_status: "pending",
        });
    }
  }

  // Update draw to published status
  const { error: updateError } = await admin
    .from("draws")
    .update({
      status: "published",
      numbers: finalNumbers,
      published_at: new Date().toISOString(),
      algorithm_version: draw.type === "random" ? "random-v1" : "algorithmic-v1",
      generation_audit: {
        ...draw.generation_audit,
        published_at: new Date().toISOString(),
        published_by: profile.id,
      },
    })
    .eq("id", validated.draw_id);

  if (updateError) {
    throw new Error(`Failed to publish draw: ${updateError.message}`);
  }

  return {
    draw_id: validated.draw_id,
    numbers: finalNumbers,
    prize_pool: prizePoolRecord,
    winners_count: winners.length,
  };
}

/**
 * Get a draw by ID
 * Requires admin authorization for unpublished draws
 */
export async function getDraw(drawId: string) {
  const admin = createAdminClient();

  const { data: draw, error } = await admin
    .from("draws")
    .select("*")
    .eq("id", drawId)
    .single();

  if (error || !draw) {
    throw new Error("Draw not found");
  }

  return draw;
}

/**
 * Get draw history
 * Requires admin authorization
 */
export async function getDrawHistory(limit: number = 12) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: draws, error } = await admin
    .from("draws")
    .select("*")
    .order("draw_month", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch draw history: ${error.message}`);
  }

  return draws || [];
}

/**
 * Update a draft draw configuration
 * Requires admin authorization
 */
export async function updateDraw(input: z.infer<typeof updateDrawSchema>) {
  await requireAdmin();
  const admin = createAdminClient();

  const validated = updateDrawSchema.parse(input);

  // Fetch current draw
  const { data: draw, error: fetchError } = await admin
    .from("draws")
    .select("*")
    .eq("id", validated.draw_id)
    .single();

  if (fetchError || !draw) {
    throw new Error("Draw not found");
  }

  if (!canModifyDraw(draw.status as DrawStatus)) {
    throw new Error(`Cannot modify draw with status '${draw.status}'`);
  }

  // Prepare update object
  const updateData: Record<string, unknown> = {};
  if (validated.type !== undefined) {
    updateData.type = validated.type;
  }
  if (validated.number_range_min !== undefined) {
    updateData.number_range_min = validated.number_range_min;
  }
  if (validated.number_range_max !== undefined) {
    updateData.number_range_max = validated.number_range_max;
  }

  // Validate new configuration
  const config: DrawConfig = {
    type: (validated.type || draw.type) as DrawType,
    numberRange: {
      min: validated.number_range_min || draw.number_range_min,
      max: validated.number_range_max || draw.number_range_max,
    },
    count: 5,
  };
  validateDrawConfig(config);

  // Update draw
  const { data: updatedDraw, error: updateError } = await admin
    .from("draws")
    .update(updateData)
    .eq("id", validated.draw_id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update draw: ${updateError.message}`);
  }

  return updatedDraw;
}

/**
 * Cancel a draw
 * Requires admin authorization
 */
export async function cancelDraw(drawId: string) {
  const { profile } = await requireAdmin();
  const admin = createAdminClient();

  // Fetch current draw
  const { data: draw, error: fetchError } = await admin
    .from("draws")
    .select("*")
    .eq("id", drawId)
    .single();

  if (fetchError || !draw) {
    throw new Error("Draw not found");
  }

  if (!isValidStateTransition(draw.status as DrawStatus, "cancelled")) {
    throw new Error(`Cannot cancel draw with status '${draw.status}'`);
  }

  // Update draw status
  const { error: updateError } = await admin
    .from("draws")
    .update({
      status: "cancelled",
      generation_audit: {
        ...draw.generation_audit,
        cancelled_at: new Date().toISOString(),
        cancelled_by: profile.id,
      },
    })
    .eq("id", drawId);

  if (updateError) {
    throw new Error(`Failed to cancel draw: ${updateError.message}`);
  }

  return { success: true };
}
