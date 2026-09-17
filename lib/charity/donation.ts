import "server-only";

import { z } from "zod";
import { requireUser } from "@/lib/auth/authorization";
import { stripeClient } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Validation schemas
const createDonationSchema = z.object({
  charity_id: z.string().uuid("Invalid charity ID"),
  amount_minor: z.number().int().min(100, "Minimum donation is £1.00").max(1000000, "Maximum donation is £10,000.00"),
  currency: z.string().length(3).default("GBP"),
});

export type CreateDonationInput = z.infer<typeof createDonationSchema>;

export type DonationSession = {
  checkout_url: string;
  donation_id: string;
  amount_minor: number;
  currency: string;
  charity_id: string;
};

/**
 * Create a one-time donation checkout session
 * 
 * IMPLEMENTATION STATUS:
 * This creates a Stripe Checkout session for one-time donations.
 * The PRD requires independent donation capability.
 * 
 * Current implementation:
 * - Creates Stripe Checkout session for one-time payment
 * - Validates charity is active
 * - Validates amount is within reasonable bounds
 * - Records donation intent in database
 * - Returns checkout URL for user to complete payment
 * 
 * Completion handling:
 * - Webhook will process successful donations
 * - Donation will be recorded in charity_contributions table
 * - Source will be marked as 'donation'
 * 
 * Server-side validation ensures:
 * - User is authenticated
 * - Charity exists and is active
 * - Amount is reasonable (not from client trust)
 * - Currency is valid
 */
export async function createDonationCheckout(input: CreateDonationInput): Promise<DonationSession> {
  const user = await requireUser();
  const admin = createAdminClient();

  const validated = createDonationSchema.parse(input);

  // Verify charity exists and is active
  const { data: charity, error: charityError } = await admin
    .from("charities")
    .select("id, name, is_active")
    .eq("id", validated.charity_id)
    .single();

  if (charityError || !charity) {
    throw new Error("Charity not found");
  }

  if (!charity.is_active) {
    throw new Error("Cannot donate to an inactive charity");
  }

  // Create Stripe Checkout session for one-time donation
  try {
    const stripe = stripeClient();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: validated.currency.toLowerCase(),
            product_data: {
              name: `Donation to ${charity.name}`,
              description: "One-time charitable donation",
            },
            unit_amount: validated.amount_minor,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?donation=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?donation=cancelled`,
      metadata: {
        user_id: user.id,
        charity_id: validated.charity_id,
        donation_type: "one_time",
        app_donation: "true",
      },
      customer_email: user.email,
    });

    if (!checkoutSession.url) {
      throw new Error("Failed to create checkout session");
    }

    // Record donation intent in database (will be updated by webhook)
    const { data: contribution, error: insertError } = await admin
      .from("charity_contributions")
      .insert({
        user_id: user.id,
        charity_id: validated.charity_id,
        subscription_id: null, // No subscription for one-time donations
        percentage: 100, // 100% of amount goes to charity
        amount_minor: validated.amount_minor,
        currency: validated.currency,
        source: "donation",
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to record donation: ${insertError.message}`);
    }

    return {
      checkout_url: checkoutSession.url,
      donation_id: contribution.id,
      amount_minor: validated.amount_minor,
      currency: validated.currency,
      charity_id: validated.charity_id,
    };
  } catch (error) {
    throw new Error(`Failed to create donation checkout: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get donation history for current user
 */
export async function getUserDonations() {
  const user = await requireUser();
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("charity_contributions")
    .select(`
      id,
      amount_minor,
      currency,
      percentage,
      source,
      created_at,
      charities (
        id,
        name,
        slug
      )
    `)
    .eq("user_id", user.id)
    .eq("source", "donation")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch donation history: ${error.message}`);
  }

  return data || [];
}

/**
 * Validate donation amount
 * Server-side validation to prevent client manipulation
 */
export function validateDonationAmount(amount_minor: number): boolean {
  const MIN_DONATION_MINOR = 100; // £1.00
  const MAX_DONATION_MINOR = 1000000; // £10,000.00

  return (
    Number.isInteger(amount_minor) &&
    amount_minor >= MIN_DONATION_MINOR &&
    amount_minor <= MAX_DONATION_MINOR
  );
}
