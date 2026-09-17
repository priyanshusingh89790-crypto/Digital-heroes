import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireSubscriber } from "@/lib/auth/authorization";
import type { CreateScoreInput, UpdateScoreInput, GolfScore } from "./scores";

/**
 * Get the latest 5 scores for the authenticated user
 * Returns scores in reverse chronological order (most recent first)
 */
export async function getLatestScores(): Promise<GolfScore[]> {
  const { user } = await requireSubscriber();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("golf_scores")
    .select("*")
    .eq("user_id", user.id)
    .order("score_date", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`Failed to fetch scores: ${error.message}`);
  }

  return data || [];
}

/**
 * Create a new golf score
 * Enforces 5-score rolling rule via database trigger
 * Prevents duplicate dates via unique constraint
 */
export async function createScore(input: CreateScoreInput): Promise<GolfScore> {
  const { user } = await requireSubscriber();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("golf_scores")
    .insert({
      user_id: user.id,
      score_date: input.score_date,
      stableford_score: input.score,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation for duplicate date
    if (error.code === "23505") {
      throw new Error("A score for this date already exists. Please edit the existing score instead.");
    }
    throw new Error(`Failed to create score: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing golf score
 * Only allows updating the user's own scores
 */
export async function updateScore(input: UpdateScoreInput): Promise<GolfScore> {
  const { user } = await requireSubscriber();
  const supabase = await createClient();

  // First verify the score belongs to the user
  const { data: existing } = await supabase
    .from("golf_scores")
    .select("user_id")
    .eq("id", input.id)
    .single();

  if (!existing || existing.user_id !== user.id) {
    throw new Error("Score not found or access denied");
  }

  const { data, error } = await supabase
    .from("golf_scores")
    .update({
      score_date: input.score_date,
      stableford_score: input.score,
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation for duplicate date
    if (error.code === "23505") {
      throw new Error("A score for this date already exists. Please choose a different date.");
    }
    throw new Error(`Failed to update score: ${error.message}`);
  }

  return data;
}

/**
 * Delete a golf score
 * Only allows deleting the user's own scores
 */
export async function deleteScore(id: string): Promise<void> {
  const { user } = await requireSubscriber();
  const supabase = await createClient();

  // First verify the score belongs to the user
  const { data: existing } = await supabase
    .from("golf_scores")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!existing || existing.user_id !== user.id) {
    throw new Error("Score not found or access denied");
  }

  const { error } = await supabase
    .from("golf_scores")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete score: ${error.message}`);
  }
}

/**
 * Get a single score by ID
 * Only allows accessing the user's own scores
 */
export async function getScoreById(id: string): Promise<GolfScore> {
  const { user } = await requireSubscriber();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("golf_scores")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch score: ${error.message}`);
  }

  return data;
}
