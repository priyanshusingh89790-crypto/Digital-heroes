import { hasActiveSubscription } from "../billing/access";
import { formatPrice } from "../billing/plans";

export type CancellationStatus = "none" | "scheduled" | "cancelled";

export type SubscriptionRecord = {
  status: string;
  plan_interval: string;
  unit_amount_minor: number;
  currency: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
};

export type SubscriptionStatusView = {
  status: string;
  plan_interval: string;
  plan_label: "Monthly" | "Yearly" | "Unknown";
  unit_amount_minor: number;
  currency: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  is_active: boolean;
  formatted_amount: string;
  formatted_period_end: string | null;
  cancellation_status: CancellationStatus;
};

export type DrawParticipationView = {
  draw_id: string | null;
  draw_month: string | null;
  formatted_draw_month: string | null;
  draw_numbers: number[] | null;
  user_entry_numbers: number[] | null;
  matched_count: number | null;
  matched_numbers: number[] | null;
  matched_tier_label: "5-match" | "4-match" | "3-match" | "no-match" | null;
  is_winner: boolean;
  winner_tier: number | null;
  verification_status: string | null;
  has_draw: boolean;
  has_entry: boolean;
};

export type WinningRecordView = {
  id: string;
  tier: number;
  prize_amount_minor: number;
  prize_formatted: string;
  verification_status: string;
  payout_status: string | null;
  rejection_reason: string | null;
  created_at: string;
  draw_month: string | null;
  proofs: Array<{ id: string; original_filename: string; submitted_at: string }>;
  can_upload_proof: boolean;
  payment_state: PaymentDisplayState;
};

export type WinningsStatusView = {
  has_winnings: boolean;
  total_winnings_minor: number;
  total_winnings_formatted: string;
  pending_verification: number;
  approved: number;
  rejected: number;
  paid: number;
  summary_state: PaymentDisplayState;
  recent_winnings: WinningRecordView[];
};

export type PaymentDisplayState =
  | "none"
  | "pending_verification"
  | "approved"
  | "rejected"
  | "paid";

export type DashboardSummaryView = {
  subscription_label: string;
  latest_score: number | null;
  latest_score_date: string | null;
  charity_name: string | null;
  contribution_formatted: string | null;
  contribution_percentage: number | null;
  latest_draw_label: string;
  winnings_label: string;
};

const emptySubscription = (): SubscriptionStatusView => ({
  status: "none",
  plan_interval: "month",
  plan_label: "Unknown",
  unit_amount_minor: 0,
  currency: "GBP",
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
  canceled_at: null,
  is_active: false,
  formatted_amount: formatPrice(0),
  formatted_period_end: null,
  cancellation_status: "none",
});

export function planLabelFromInterval(interval: string): "Monthly" | "Yearly" | "Unknown" {
  if (interval === "month") return "Monthly";
  if (interval === "year") return "Yearly";
  return "Unknown";
}

export function formatDisplayDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDrawMonth(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "long", timeZone: "UTC" });
}

export function mapSubscriptionRecord(
  subscription: SubscriptionRecord | null,
  now = new Date(),
): SubscriptionStatusView {
  if (!subscription) {
    return emptySubscription();
  }

  const isActive = hasActiveSubscription(
    {
      status: subscription.status,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      plan_interval: subscription.plan_interval,
    },
    now,
  );

  let cancellationStatus: CancellationStatus = "none";
  if (subscription.cancel_at_period_end && isActive) {
    cancellationStatus = "scheduled";
  } else if (!isActive && (subscription.status === "canceled" || subscription.status === "expired" || subscription.cancel_at_period_end)) {
    cancellationStatus = "cancelled";
  } else if (!isActive) {
    cancellationStatus = "none";
  }

  return {
    status: subscription.status,
    plan_interval: subscription.plan_interval,
    plan_label: planLabelFromInterval(subscription.plan_interval),
    unit_amount_minor: subscription.unit_amount_minor,
    currency: subscription.currency,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at,
    is_active: isActive,
    formatted_amount: formatPrice(subscription.unit_amount_minor),
    formatted_period_end: formatDisplayDate(subscription.current_period_end),
    cancellation_status: cancellationStatus,
  };
}

export function latestFiveScores<T extends { score_date: string }>(scores: T[]): T[] {
  return [...scores]
    .sort((a, b) => b.score_date.localeCompare(a.score_date))
    .slice(0, 5);
}

export function matchTierLabel(
  matchedCount: number | null,
): DrawParticipationView["matched_tier_label"] {
  if (matchedCount === null) return null;
  if (matchedCount === 5) return "5-match";
  if (matchedCount === 4) return "4-match";
  if (matchedCount === 3) return "3-match";
  return "no-match";
}

export function mapDrawParticipation(input: {
  draw: { id: string; draw_month: string; numbers: number[] | null } | null;
  entry: { selected_numbers: number[] } | null;
  result: { matched_count: number; matched_numbers: number[] } | null;
  winner: { tier: number; verification_status: string } | null;
}): DrawParticipationView {
  if (!input.draw) {
    return {
      draw_id: null,
      draw_month: null,
      formatted_draw_month: null,
      draw_numbers: null,
      user_entry_numbers: null,
      matched_count: null,
      matched_numbers: null,
      matched_tier_label: null,
      is_winner: false,
      winner_tier: null,
      verification_status: null,
      has_draw: false,
      has_entry: false,
    };
  }

  if (!input.entry) {
    return {
      draw_id: input.draw.id,
      draw_month: input.draw.draw_month,
      formatted_draw_month: formatDrawMonth(input.draw.draw_month),
      draw_numbers: input.draw.numbers,
      user_entry_numbers: null,
      matched_count: null,
      matched_numbers: null,
      matched_tier_label: null,
      is_winner: false,
      winner_tier: null,
      verification_status: null,
      has_draw: true,
      has_entry: false,
    };
  }

  return {
    draw_id: input.draw.id,
    draw_month: input.draw.draw_month,
    formatted_draw_month: formatDrawMonth(input.draw.draw_month),
    draw_numbers: input.draw.numbers,
    user_entry_numbers: input.entry.selected_numbers,
    matched_count: input.result?.matched_count ?? null,
    matched_numbers: input.result?.matched_numbers ?? null,
    matched_tier_label: matchTierLabel(input.result?.matched_count ?? null),
    is_winner: Boolean(input.winner),
    winner_tier: input.winner?.tier ?? null,
    verification_status: input.winner?.verification_status ?? null,
    has_draw: true,
    has_entry: true,
  };
}

export function canUploadWinnerProof(verificationStatus: string): boolean {
  return verificationStatus === "pending" || verificationStatus === "submitted";
}

export function subscriberCanApproveWinnings(): boolean {
  return false;
}

export function paymentStateFromWinner(input: {
  verification_status: string;
  payout_status: string | null;
}): PaymentDisplayState {
  if (input.payout_status === "paid" || input.verification_status === "paid") {
    return "paid";
  }
  if (input.verification_status === "rejected") {
    return "rejected";
  }
  if (input.verification_status === "approved") {
    return "approved";
  }
  return "pending_verification";
}

export function summarizePaymentState(winnings: WinningRecordView[]): PaymentDisplayState {
  if (winnings.length === 0) return "none";
  const states = new Set(winnings.map((winning) => winning.payment_state));
  if (states.has("paid")) return "paid";
  if (states.has("approved")) return "approved";
  if (states.has("pending_verification")) return "pending_verification";
  if (states.has("rejected")) return "rejected";
  return "none";
}

export function paymentStateLabel(state: PaymentDisplayState): string {
  switch (state) {
    case "paid":
      return "Paid";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "pending_verification":
      return "Pending verification";
    default:
      return "No winnings";
  }
}

export function asRelationArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function mapWinnings(rows: Array<{
  id: string;
  tier: number;
  prize_amount_minor: number;
  verification_status: string;
  rejection_reason?: string | null;
  created_at: string;
  payouts?: { status: string } | Array<{ status: string }> | null;
  winner_proofs?: Array<{ id: string; original_filename: string; submitted_at: string }> | { id: string; original_filename: string; submitted_at: string } | null;
  draw_results?: { draws?: { draw_month: string } | null } | Array<{ draws?: { draw_month: string } | null }> | null;
}>): WinningsStatusView {
  const recent_winnings: WinningRecordView[] = rows.map((row) => {
    const payout = asRelationArray(row.payouts)[0] ?? null;
    const proofs = asRelationArray(row.winner_proofs);
    const drawResult = asRelationArray(row.draw_results)[0] ?? null;
    const payment_state = paymentStateFromWinner({
      verification_status: row.verification_status,
      payout_status: payout?.status ?? null,
    });

    return {
      id: row.id,
      tier: row.tier,
      prize_amount_minor: row.prize_amount_minor,
      prize_formatted: formatPrice(row.prize_amount_minor),
      verification_status: row.verification_status,
      payout_status: payout?.status ?? null,
      rejection_reason: row.rejection_reason ?? null,
      created_at: row.created_at,
      draw_month: drawResult?.draws?.draw_month ?? null,
      proofs,
      can_upload_proof: canUploadWinnerProof(row.verification_status),
      payment_state,
    };
  });

  const pending_verification = recent_winnings.filter((item) => item.payment_state === "pending_verification").length;
  const approved = recent_winnings.filter((item) => item.payment_state === "approved").length;
  const rejected = recent_winnings.filter((item) => item.payment_state === "rejected").length;
  const paid = recent_winnings.filter((item) => item.payment_state === "paid").length;
  const total_winnings_minor = recent_winnings.reduce((sum, item) => sum + item.prize_amount_minor, 0);

  return {
    has_winnings: recent_winnings.length > 0,
    total_winnings_minor,
    total_winnings_formatted: formatPrice(total_winnings_minor),
    pending_verification,
    approved,
    rejected,
    paid,
    summary_state: summarizePaymentState(recent_winnings),
    recent_winnings,
  };
}

export function mapDashboardSummary(input: {
  subscription: SubscriptionStatusView;
  latestScore: { stableford_score: number; score_date: string } | null;
  charityName: string | null;
  contributionPercentage: number | null;
  contributionFormatted: string | null;
  draw: DrawParticipationView;
  winnings: WinningsStatusView;
}): DashboardSummaryView {
  let subscription_label = "Inactive";
  if (input.subscription.status === "none") {
    subscription_label = "No subscription";
  } else if (input.subscription.is_active && input.subscription.cancellation_status === "scheduled") {
    subscription_label = "Active, cancelling";
  } else if (input.subscription.is_active) {
    subscription_label = "Active";
  }

  let latest_draw_label = "No published draw";
  if (input.draw.has_draw && !input.draw.has_entry) {
    latest_draw_label = input.draw.formatted_draw_month
      ? `${input.draw.formatted_draw_month} · not entered`
      : "Not entered";
  } else if (input.draw.has_entry && input.draw.matched_tier_label) {
    latest_draw_label = `${input.draw.formatted_draw_month ?? "Latest draw"} · ${input.draw.matched_tier_label}`;
  } else if (input.draw.has_draw) {
    latest_draw_label = input.draw.formatted_draw_month ?? "Latest draw";
  }

  return {
    subscription_label,
    latest_score: input.latestScore?.stableford_score ?? null,
    latest_score_date: input.latestScore?.score_date ?? null,
    charity_name: input.charityName,
    contribution_formatted: input.contributionFormatted,
    contribution_percentage: input.contributionPercentage,
    latest_draw_label,
    winnings_label: paymentStateLabel(input.winnings.summary_state),
  };
}
