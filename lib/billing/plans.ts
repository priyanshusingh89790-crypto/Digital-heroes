import { z } from "zod";

export const billingCurrency = "GBP";
export const planIds = ["monthly", "yearly"] as const;
export type PlanId = (typeof planIds)[number];

// Implementation values, not PRD-defined prices. Stripe price IDs remain server-only.
export const plans = {
  monthly: { id: "monthly", name: "Monthly", interval: "month", unitAmountMinor: 1200, description: "Flexible monthly membership" },
  yearly: { id: "yearly", name: "Yearly", interval: "year", unitAmountMinor: 12000, description: "Annual membership with two months free" },
} as const satisfies Record<PlanId, { id: PlanId; name: string; interval: "month" | "year"; unitAmountMinor: number; description: string }>;

export const planSchema = z.enum(planIds);
export function resolvePlan(value: unknown) { return plans[planSchema.parse(value)]; }
export function formatPrice(amountMinor: number) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: billingCurrency }).format(amountMinor / 100); }
