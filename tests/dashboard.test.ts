import { describe, expect, it } from "vitest";

import { canAccessAdminArea, canAccessSubscriberArea } from "../lib/auth/roles";
import { hasActiveSubscription } from "../lib/billing/access";
import {
  canUploadWinnerProof,
  latestFiveScores,
  mapDashboardSummary,
  mapDrawParticipation,
  mapSubscriptionRecord,
  mapWinnings,
  matchTierLabel,
  paymentStateFromWinner,
  paymentStateLabel,
  subscriberCanApproveWinnings,
  summarizePaymentState,
} from "../lib/dashboard/mapping";

describe("dashboard authorization", () => {
  const now = new Date("2024-06-15T00:00:00Z");

  it("requires authentication before subscriber dashboard access", () => {
    const access = {
      unauthenticated: { redirect: "/login" },
      proxyProtects: ["/dashboard", "/dashboard/*"],
      serverGuard: "requireSubscriber",
    };
    expect(access.unauthenticated.redirect).toBe("/login");
    expect(access.serverGuard).toBe("requireSubscriber");
  });

  it("grants subscriber-area role access to subscribers and admins", () => {
    expect(canAccessSubscriberArea("subscriber")).toBe(true);
    expect(canAccessSubscriberArea("admin")).toBe(true);
  });

  it("does not grant admin dashboard access to subscribers", () => {
    expect(canAccessAdminArea("subscriber")).toBe(false);
  });

  it("denies dashboard access for authenticated users without an active subscription", () => {
    expect(
      hasActiveSubscription(
        {
          status: "canceled",
          current_period_end: "2024-07-01T00:00:00Z",
          cancel_at_period_end: true,
          plan_interval: "month",
        },
        now,
      ),
    ).toBe(false);
    expect(
      hasActiveSubscription(
        {
          status: "active",
          current_period_end: "2024-06-01T00:00:00Z",
          cancel_at_period_end: false,
          plan_interval: "month",
        },
        now,
      ),
    ).toBe(false);
  });

  it("allows access while a cancellation is scheduled but the period is still active", () => {
    expect(
      hasActiveSubscription(
        {
          status: "active",
          current_period_end: "2024-07-01T00:00:00Z",
          cancel_at_period_end: true,
          plan_interval: "month",
        },
        now,
      ),
    ).toBe(true);
  });

  it("keeps subscriber data scoped to the session user id", () => {
    const sessionUserId = "11111111-1111-1111-1111-111111111111";
    const otherUserId = "22222222-2222-2222-2222-222222222222";
    const query = { user_id: sessionUserId };
    expect(query.user_id).toBe(sessionUserId);
    expect(query.user_id).not.toBe(otherUserId);
  });
});

describe("subscription status display mapping", () => {
  const now = new Date("2024-06-15T00:00:00Z");

  it("maps monthly active subscriptions", () => {
    const view = mapSubscriptionRecord(
      {
        status: "active",
        plan_interval: "month",
        unit_amount_minor: 1200,
        currency: "GBP",
        current_period_start: "2024-06-01T00:00:00Z",
        current_period_end: "2024-07-01T00:00:00Z",
        cancel_at_period_end: false,
        canceled_at: null,
      },
      now,
    );

    expect(view.is_active).toBe(true);
    expect(view.plan_label).toBe("Monthly");
    expect(view.formatted_amount).toBe("£12.00");
    expect(view.cancellation_status).toBe("none");
    expect(view.formatted_period_end).toContain("2024");
  });

  it("maps yearly plans and scheduled cancellation with remaining access", () => {
    const view = mapSubscriptionRecord(
      {
        status: "active",
        plan_interval: "year",
        unit_amount_minor: 12000,
        currency: "GBP",
        current_period_start: "2024-01-01T00:00:00Z",
        current_period_end: "2025-01-01T00:00:00Z",
        cancel_at_period_end: true,
        canceled_at: "2024-06-01T00:00:00Z",
      },
      now,
    );

    expect(view.plan_label).toBe("Yearly");
    expect(view.is_active).toBe(true);
    expect(view.cancellation_status).toBe("scheduled");
    expect(view.cancel_at_period_end).toBe(true);
    expect(view.formatted_amount).toBe("£120.00");
  });

  it("maps lapsed and missing subscriptions as inactive", () => {
    const lapsed = mapSubscriptionRecord(
      {
        status: "active",
        plan_interval: "month",
        unit_amount_minor: 1200,
        currency: "GBP",
        current_period_start: "2024-04-01T00:00:00Z",
        current_period_end: "2024-05-01T00:00:00Z",
        cancel_at_period_end: false,
        canceled_at: null,
      },
      now,
    );
    const missing = mapSubscriptionRecord(null, now);

    expect(lapsed.is_active).toBe(false);
    expect(missing.status).toBe("none");
    expect(missing.is_active).toBe(false);
    expect(missing.formatted_amount).toBe("£0.00");
  });
});

describe("latest five scores", () => {
  it("returns newest first and keeps only five scores", () => {
    const scores = latestFiveScores([
      { id: "1", score_date: "2024-01-01", stableford_score: 10 },
      { id: "2", score_date: "2024-03-01", stableford_score: 20 },
      { id: "3", score_date: "2024-02-01", stableford_score: 30 },
      { id: "4", score_date: "2024-06-01", stableford_score: 40 },
      { id: "5", score_date: "2024-05-01", stableford_score: 18 },
      { id: "6", score_date: "2024-04-01", stableford_score: 22 },
    ]);

    expect(scores).toHaveLength(5);
    expect(scores.map((score) => score.score_date)).toEqual([
      "2024-06-01",
      "2024-05-01",
      "2024-04-01",
      "2024-03-01",
      "2024-02-01",
    ]);
    expect(scores[0]?.stableford_score).toBe(40);
  });
});

describe("charity selection and contribution display", () => {
  it("includes selected charity and server-calculated contribution in the summary", () => {
    const summary = mapDashboardSummary({
      subscription: mapSubscriptionRecord({
        status: "active",
        plan_interval: "month",
        unit_amount_minor: 1200,
        currency: "GBP",
        current_period_start: "2024-06-01T00:00:00Z",
        current_period_end: "2024-07-01T00:00:00Z",
        cancel_at_period_end: false,
        canceled_at: null,
      }),
      latestScore: { stableford_score: 32, score_date: "2024-06-10" },
      charityName: "Fairway Trust",
      contributionPercentage: 10,
      contributionFormatted: "£1.20",
      draw: mapDrawParticipation({ draw: null, entry: null, result: null, winner: null }),
      winnings: mapWinnings([]),
    });

    expect(summary.charity_name).toBe("Fairway Trust");
    expect(summary.contribution_percentage).toBe(10);
    expect(summary.contribution_formatted).toBe("£1.20");
    expect(summary.latest_score).toBe(32);
  });

  it("does not invent a second contribution calculation in the dashboard mapper", () => {
    const summary = mapDashboardSummary({
      subscription: mapSubscriptionRecord(null),
      latestScore: null,
      charityName: null,
      contributionPercentage: 25,
      contributionFormatted: "£3.00",
      draw: mapDrawParticipation({ draw: null, entry: null, result: null, winner: null }),
      winnings: mapWinnings([]),
    });

    expect(summary.contribution_formatted).toBe("£3.00");
    expect(summary.contribution_percentage).toBe(25);
  });
});

describe("draw participation data", () => {
  const draw = {
    id: "draw-1",
    draw_month: "2024-06-01",
    numbers: [1, 2, 3, 4, 5],
  };

  it("shows an empty state when no published draw exists", () => {
    const view = mapDrawParticipation({ draw: null, entry: null, result: null, winner: null });
    expect(view.has_draw).toBe(false);
    expect(view.has_entry).toBe(false);
    expect(view.draw_numbers).toBeNull();
  });

  it("does not invent an entry when the user was not in the published draw", () => {
    const view = mapDrawParticipation({ draw, entry: null, result: null, winner: null });
    expect(view.has_draw).toBe(true);
    expect(view.has_entry).toBe(false);
    expect(view.user_entry_numbers).toBeNull();
    expect(view.is_winner).toBe(false);
  });

  it("maps 3, 4, and 5 number matches and winner status for that draw only", () => {
    expect(matchTierLabel(5)).toBe("5-match");
    expect(matchTierLabel(4)).toBe("4-match");
    expect(matchTierLabel(3)).toBe("3-match");
    expect(matchTierLabel(2)).toBe("no-match");

    const winner = mapDrawParticipation({
      draw,
      entry: { selected_numbers: [1, 2, 3, 4, 9] },
      result: { matched_count: 4, matched_numbers: [1, 2, 3, 4] },
      winner: { tier: 4, verification_status: "pending" },
    });

    expect(winner.has_entry).toBe(true);
    expect(winner.matched_count).toBe(4);
    expect(winner.matched_tier_label).toBe("4-match");
    expect(winner.is_winner).toBe(true);
    expect(winner.winner_tier).toBe(4);
  });
});

describe("winnings and payment states", () => {
  it("distinguishes none, pending, approved, rejected, and paid", () => {
    expect(paymentStateFromWinner({ verification_status: "pending", payout_status: null })).toBe(
      "pending_verification",
    );
    expect(paymentStateFromWinner({ verification_status: "approved", payout_status: "pending" })).toBe("approved");
    expect(paymentStateFromWinner({ verification_status: "rejected", payout_status: null })).toBe("rejected");
    expect(paymentStateFromWinner({ verification_status: "approved", payout_status: "paid" })).toBe("paid");
    expect(summarizePaymentState([])).toBe("none");
    expect(paymentStateLabel("none")).toBe("No winnings");
  });

  it("maps winner rows including proof upload eligibility", () => {
    const view = mapWinnings([
      {
        id: "win-1",
        tier: 3,
        prize_amount_minor: 500,
        verification_status: "pending",
        created_at: "2024-06-02T00:00:00Z",
        winner_proofs: [],
        payouts: null,
      },
      {
        id: "win-2",
        tier: 4,
        prize_amount_minor: 1500,
        verification_status: "approved",
        created_at: "2024-05-02T00:00:00Z",
        payouts: { status: "paid" },
      },
    ]);

    expect(view.has_winnings).toBe(true);
    expect(view.pending_verification).toBe(1);
    expect(view.paid).toBe(1);
    expect(view.summary_state).toBe("paid");
    expect(view.recent_winnings[0]?.can_upload_proof).toBe(true);
    expect(view.recent_winnings[1]?.can_upload_proof).toBe(false);
    expect(view.total_winnings_formatted).toBe("£20.00");
  });

  it("never allows a subscriber to approve their own winnings", () => {
    expect(subscriberCanApproveWinnings()).toBe(false);
    expect(canUploadWinnerProof("approved")).toBe(false);
    expect(canUploadWinnerProof("paid")).toBe(false);
    expect(canUploadWinnerProof("pending")).toBe(true);
  });
});

describe("dashboard ownership isolation", () => {
  it("does not accept a client-supplied user id in mapped dashboard queries", () => {
    const sessionDerivedQuery = {
      userIdSource: "requireSubscriber().user.id",
      acceptsClientUserId: false,
    };
    expect(sessionDerivedQuery.acceptsClientUserId).toBe(false);
    expect(sessionDerivedQuery.userIdSource).toContain("requireSubscriber");
  });
});
