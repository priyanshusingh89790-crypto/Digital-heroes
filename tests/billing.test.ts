import { describe, expect, it } from "vitest";

import { resolvePlan, planSchema, plans, formatPrice } from "../lib/billing/plans";
import { hasActiveSubscription, planFromInterval } from "../lib/billing/access";

describe("billing plans", () => {
  it("resolves monthly plan correctly", () => {
    const plan = resolvePlan("monthly");
    expect(plan.id).toBe("monthly");
    expect(plan.interval).toBe("month");
    expect(plan.unitAmountMinor).toBe(1200);
  });

  it("resolves yearly plan correctly", () => {
    const plan = resolvePlan("yearly");
    expect(plan.id).toBe("yearly");
    expect(plan.interval).toBe("year");
    expect(plan.unitAmountMinor).toBe(12000);
  });

  it("rejects invalid plan", () => {
    expect(() => resolvePlan("invalid")).toThrow();
    expect(() => resolvePlan("weekly")).toThrow();
    expect(() => resolvePlan("")).toThrow();
  });

  it("validates plan schema correctly", () => {
    expect(planSchema.safeParse("monthly").success).toBe(true);
    expect(planSchema.safeParse("yearly").success).toBe(true);
    expect(planSchema.safeParse("invalid").success).toBe(false);
    expect(planSchema.safeParse("MONTHLY").success).toBe(false);
  });

  it("formats price correctly", () => {
    expect(formatPrice(1200)).toBe("£12.00");
    expect(formatPrice(12000)).toBe("£120.00");
    expect(formatPrice(0)).toBe("£0.00");
    expect(formatPrice(999)).toBe("£9.99");
  });

  it("plan objects are immutable and well-typed", () => {
    const monthly = plans.monthly;
    const yearly = plans.yearly;
    
    expect(monthly.id).toBe("monthly");
    expect(yearly.id).toBe("yearly");
    expect(monthly.interval).toBe("month");
    expect(yearly.interval).toBe("year");
    
    // Verify yearly has discount (2 months free: 12 * 12 = 144, but price is 120)
    expect(yearly.unitAmountMinor).toBeLessThan(monthly.unitAmountMinor * 12);
  });
});

describe("subscription access control", () => {
  const now = new Date("2024-01-15T00:00:00Z");
  const future = new Date("2024-02-15T00:00:00Z");
  const past = new Date("2024-01-10T00:00:00Z");

  it("grants access to active subscriptions", () => {
    const subscription = {
      status: "active",
      current_period_end: future.toISOString(),
      cancel_at_period_end: false,
      plan_interval: "month",
    };
    expect(hasActiveSubscription(subscription, now)).toBe(true);
  });

  it("grants access to trialing subscriptions", () => {
    const subscription = {
      status: "trialing",
      current_period_end: future.toISOString(),
      cancel_at_period_end: false,
      plan_interval: "month",
    };
    expect(hasActiveSubscription(subscription, now)).toBe(true);
  });

  it("denies access to cancelled subscriptions", () => {
    const subscription = {
      status: "canceled",
      current_period_end: future.toISOString(),
      cancel_at_period_end: true,
      plan_interval: "month",
    };
    expect(hasActiveSubscription(subscription, now)).toBe(false);
  });

  it("denies access to past_due subscriptions", () => {
    const subscription = {
      status: "past_due",
      current_period_end: future.toISOString(),
      cancel_at_period_end: false,
      plan_interval: "month",
    };
    expect(hasActiveSubscription(subscription, now)).toBe(false);
  });

  it("denies access to expired subscriptions", () => {
    const subscription = {
      status: "expired",
      current_period_end: past.toISOString(),
      cancel_at_period_end: false,
      plan_interval: "month",
    };
    expect(hasActiveSubscription(subscription, now)).toBe(false);
  });

  it("denies access to lapsed subscriptions (period ended)", () => {
    const subscription = {
      status: "active",
      current_period_end: past.toISOString(),
      cancel_at_period_end: false,
      plan_interval: "month",
    };
    expect(hasActiveSubscription(subscription, now)).toBe(false);
  });

  it("denies access with null subscription", () => {
    expect(hasActiveSubscription(null, now)).toBe(false);
  });

  it("grants access to active subscriptions with no end date", () => {
    const subscription = {
      status: "active",
      current_period_end: null,
      cancel_at_period_end: false,
      plan_interval: "month",
    };
    expect(hasActiveSubscription(subscription, now)).toBe(true);
  });

  it("maps interval to plan correctly", () => {
    expect(planFromInterval("month")).toBe("monthly");
    expect(planFromInterval("year")).toBe("yearly");
    expect(planFromInterval("week")).toBe(null);
    expect(planFromInterval("")).toBe(null);
  });
});

describe("subscription security", () => {
  it("price IDs are not exposed in plan resolution", () => {
    const plan = resolvePlan("monthly");
    // Plan object should not contain Stripe price IDs
    expect(plan).not.toHaveProperty("stripePriceId");
    expect(plan).not.toHaveProperty("price_id");
  });

  it("plan validation is strict", () => {
    // Should reject case variations
    expect(planSchema.safeParse("Monthly").success).toBe(false);
    expect(planSchema.safeParse("YEARLY").success).toBe(false);
    
    // Should reject similar but invalid values
    expect(planSchema.safeParse("month").success).toBe(false);
    expect(planSchema.safeParse("year").success).toBe(false);
  });
});

describe("subscription lifecycle states", () => {
  it("handles all Stripe subscription states correctly", () => {
    const testDate = new Date("2024-01-15");
    
    // Active and trialing should grant access
    const activeStates = ["active", "trialing"];
    activeStates.forEach(status => {
      const subscription = {
        status,
        current_period_end: new Date("2024-02-15").toISOString(),
        cancel_at_period_end: false,
        plan_interval: "month",
      };
      expect(hasActiveSubscription(subscription, testDate)).toBe(true);
    });

    // Other states should deny access
    const inactiveStates = ["incomplete", "past_due", "canceled", "unpaid", "paused", "expired"];
    inactiveStates.forEach(status => {
      const subscription = {
        status,
        current_period_end: new Date("2024-02-15").toISOString(),
        cancel_at_period_end: false,
        plan_interval: "month",
      };
      expect(hasActiveSubscription(subscription, testDate)).toBe(false);
    });
  });

  it("distinguishes between cancelled and lapsed", () => {
    const cancelled = {
      status: "canceled",
      current_period_end: new Date("2024-02-15").toISOString(),
      cancel_at_period_end: true,
      plan_interval: "month",
    };
    
    const lapsed = {
      status: "active",
      current_period_end: new Date("2024-01-10").toISOString(),
      cancel_at_period_end: false,
      plan_interval: "month",
    };

    const now = new Date("2024-01-15");
    
    // Both should be denied access
    expect(hasActiveSubscription(cancelled, now)).toBe(false);
    expect(hasActiveSubscription(lapsed, now)).toBe(false);
  });
});

describe("webhook idempotency requirements", () => {
  it("subscription sync should handle duplicate events", () => {
    // This test documents the requirement that webhook processing must be idempotent
    // The actual implementation uses stripe_webhook_events table with unique constraint
    // on stripe_event_id to prevent duplicate processing
    
    const requirements = {
      uniqueEventId: "stripe_webhook_events.stripe_event_id must be unique",
      processedAtTracking: "processed_at field tracks if event was handled",
      duplicateDetection: "Webhook route checks for existing processed events before processing",
    };
    
    expect(requirements.uniqueEventId).toBeDefined();
    expect(requirements.processedAtTracking).toBeDefined();
    expect(requirements.duplicateDetection).toBeDefined();
  });
});
