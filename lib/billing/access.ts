import type { PlanId } from "./plans";

export type SubscriptionAccessRecord = { status: string; current_period_end: string | null; cancel_at_period_end: boolean; plan_interval: string };
export function hasActiveSubscription(subscription: SubscriptionAccessRecord | null, now = new Date()) {
  if (!subscription || !["active", "trialing"].includes(subscription.status)) return false;
  return !subscription.current_period_end || new Date(subscription.current_period_end) > now;
}
export function planFromInterval(interval: string): PlanId | null { return interval === "month" ? "monthly" : interval === "year" ? "yearly" : null; }
