import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSubscriber } from "@/lib/auth/authorization";

// Validation schemas
const updateCharitySelectionSchema = z.object({
  charity_id: z.string().uuid("Invalid charity ID"),
});

const updateContributionPercentageSchema = z.object({
  percentage: z.number().int("Contribution must be a whole number").min(10, "Contribution must be at least 10%").max(100, "Contribution cannot exceed 100%"),
});

export type UpdateCharitySelectionInput = z.infer<typeof updateCharitySelectionSchema>;
export type UpdateContributionPercentageInput = z.infer<typeof updateContributionPercentageSchema>;

export type UserCharitySelection = {
  preferred_charity_id: string | null;
  charity_contribution_percentage: number;
  charity_name: string | null;
  charity_slug: string | null;
};

/**
 * Get current user's charity selection and contribution percentage
 * Requires active subscription
 */
export async function getUserCharitySelection(): Promise<UserCharitySelection> {
  const context = await requireSubscriber();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("preferred_charity_id, charity_contribution_percentage")
    .eq("id", context.user.id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch charity selection: ${error.message}`);
  }

  let charityName: string | null = null;
  let charitySlug: string | null = null;

  if (data.preferred_charity_id) {
    const { data: charity } = await supabase
      .from("charities")
      .select("name, slug")
      .eq("id", data.preferred_charity_id)
      .maybeSingle();

    if (charity) {
      charityName = charity.name;
      charitySlug = charity.slug;
    }
  }

  return {
    preferred_charity_id: data.preferred_charity_id,
    charity_contribution_percentage: data.charity_contribution_percentage,
    charity_name: charityName,
    charity_slug: charitySlug,
  };
}

/**
 * Update user's charity selection
 * Requires active subscription and validates charity is active
 */
export async function updateCharitySelection(input: UpdateCharitySelectionInput) {
  const context = await requireSubscriber();
  const supabase = await createClient();

  const validated = updateCharitySelectionSchema.parse(input);

  // Verify charity exists and is active
  const { data: charity, error: charityError } = await supabase
    .from("charities")
    .select("id, is_active")
    .eq("id", validated.charity_id)
    .single();

  if (charityError || !charity) {
    throw new Error("Charity not found");
  }

  if (!charity.is_active) {
    throw new Error("Cannot select an inactive charity");
  }

  // Update user's charity selection
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ preferred_charity_id: validated.charity_id })
    .eq("id", context.user.id);

  if (updateError) {
    throw new Error(`Failed to update charity selection: ${updateError.message}`);
  }

  return { success: true };
}

/**
 * Update user's contribution percentage
 * Requires active subscription and validates percentage is >= 10%
 */
export async function updateContributionPercentage(input: UpdateContributionPercentageInput) {
  const context = await requireSubscriber();
  const supabase = await createClient();

  const validated = updateContributionPercentageSchema.parse(input);

  // Update user's contribution percentage
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ charity_contribution_percentage: validated.percentage })
    .eq("id", context.user.id);

  if (updateError) {
    throw new Error(`Failed to update contribution percentage: ${updateError.message}`);
  }

  return { success: true };
}

/**
 * Calculate contribution amount based on subscription and percentage
 * 
 * CALCULATION (Implementation Decision):
 * The PRD does not specify how to handle monthly vs yearly subscriptions.
 * 
 * Implementation: Apply contribution percentage to the subscription amount as-is.
 * - Monthly: contribution = subscription_amount * percentage / 100
 * - Yearly: contribution = subscription_amount * percentage / 100 (no normalization)
 * 
 * This treats the contribution as a percentage of the billing period amount.
 * Future enhancement could normalize yearly subscriptions to monthly equivalents.
 */
export async function calculateContribution(): Promise<{
  amount_minor: number;
  percentage: number;
  currency: string;
  subscription_amount_minor: number;
  plan_interval: string;
}> {
  const context = await requireSubscriber();
  const supabase = await createClient();

  // Get user's subscription and profile
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("unit_amount_minor, plan_interval, currency")
    .eq("user_id", context.user.id)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subError || !subscription) {
    throw new Error("No active subscription found");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("charity_contribution_percentage")
    .eq("id", context.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Failed to fetch profile");
  }

  // Calculate contribution amount using integer arithmetic
  const contribution_minor = Math.floor(
    (subscription.unit_amount_minor * profile.charity_contribution_percentage) / 100
  );

  return {
    amount_minor: contribution_minor,
    percentage: profile.charity_contribution_percentage,
    currency: subscription.currency,
    subscription_amount_minor: subscription.unit_amount_minor,
    plan_interval: subscription.plan_interval,
  };
}
