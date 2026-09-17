import "server-only";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { plans } from "./plans";

function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`${name} is required for Stripe billing.`); return value; }
export function isStripeConfigured() { return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_MONTHLY_PRICE_ID && process.env.STRIPE_YEARLY_PRICE_ID); }
export function stripeClient() { return new Stripe(required("STRIPE_SECRET_KEY")); }

function databaseStatus(status: Stripe.Subscription.Status) {
  if (status === "incomplete_expired") return "expired";
  return status;
}
async function userIdFor(subscription: Stripe.Subscription) {
  const direct = subscription.metadata.app_user_id;
  if (direct) return direct;
  const customer = await stripeClient().customers.retrieve(typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id);
  return customer.deleted ? null : customer.metadata.app_user_id ?? null;
}
export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const userId = await userIdFor(subscription);
  if (!userId) throw new Error(`Stripe subscription ${subscription.id} has no app_user_id metadata.`);
  const item = subscription.items.data[0];
  const interval = item?.price.recurring?.interval;
  if (interval !== "month" && interval !== "year") throw new Error(`Subscription ${subscription.id} has an unsupported interval.`);
  const admin = createAdminClient();
  const { error } = await admin.from("subscriptions").upsert({
    user_id: userId, stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id, stripe_price_id: item.price.id, plan_interval: interval,
    status: databaseStatus(subscription.status), current_period_start: item.current_period_start ? new Date(item.current_period_start * 1000).toISOString() : null,
    current_period_end: item.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end, canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    currency: (item.price.currency ?? "gbp").toUpperCase(), unit_amount_minor: item.price.unit_amount ?? plans[interval === "month" ? "monthly" : "yearly"].unitAmountMinor,
  }, { onConflict: "stripe_subscription_id" });
  if (error) throw new Error(`Subscription sync failed: ${error.message}`);
}
