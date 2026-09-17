import type { PrizePool, PrizePoolConfig, Winner, MatchTier } from './types';

/**
 * Prize contribution percentage (Implementation Decision)
 * The PRD states a fixed portion of each subscription contributes to the prize pool
 * but does NOT specify the exact percentage.
 * We use 50% as a reasonable default - this is an implementation assumption.
 * This should be configurable via environment variable in production.
 */
const DEFAULT_PRIZE_CONTRIBUTION_PERCENTAGE = 50;

/**
 * Prize distribution percentages (PRD-defined)
 */
const PRIZE_DISTRIBUTION = {
  fiveMatch: 40, // 40%
  fourMatch: 35, // 35%
  threeMatch: 25, // 25%
} as const;

/**
 * Calculate prize pool from subscription data
 * 
 * ALGORITHM (Implementation Decision):
 * The PRD does not specify how to handle monthly/yearly subscription normalization.
 * 
 * 1. Count active subscribers at draw time
 * 2. Use average subscription amount across all active subscribers (no normalization)
 *    - Implementation decision: treat all subscription amounts equally
 *    - Future enhancement could normalize yearly subscriptions (divide by 12)
 * 3. Apply prize contribution percentage to total amount
 * 4. Add previous jackpot rollover (if any)
 * 5. Distribute total pool according to PRD percentages
 * 
 * Uses integer minor currency units (pence for GBP) to avoid floating-point errors.
 */
export function calculatePrizePool(config: PrizePoolConfig): PrizePool {
  const {
    contributionPercentage = DEFAULT_PRIZE_CONTRIBUTION_PERCENTAGE,
    activeSubscriberCount,
    subscriptionAmountMinor,
    jackpotRolloverInMinor = 0,
  } = config;

  // Calculate total contribution from active subscribers
  // Normalize to monthly period by dividing yearly by 12
  const normalizedContributionPerSubscriber = subscriptionAmountMinor;
  const totalContributionMinor = normalizedContributionPerSubscriber * activeSubscriberCount;
  
  // Apply prize contribution percentage
  const prizePoolMinor = Math.floor(
    (totalContributionMinor * contributionPercentage) / 100
  );

  // Add jackpot rollover to the pool
  const totalPoolMinor = prizePoolMinor + jackpotRolloverInMinor;

  // Distribute according to PRD percentages
  // Five-match pool includes the rollover amount
  const fiveMatchPoolMinor = Math.floor((totalPoolMinor * PRIZE_DISTRIBUTION.fiveMatch) / 100);
  const fourMatchPoolMinor = Math.floor((totalPoolMinor * PRIZE_DISTRIBUTION.fourMatch) / 100);
  const threeMatchPoolMinor = Math.floor((totalPoolMinor * PRIZE_DISTRIBUTION.threeMatch) / 100);

  // Calculate remainder from rounding
  const distributedTotal = fiveMatchPoolMinor + fourMatchPoolMinor + threeMatchPoolMinor;
  const remainder = totalPoolMinor - distributedTotal;

  // Add remainder to 5-match pool (deterministic rule)
  const finalFiveMatchPoolMinor = fiveMatchPoolMinor + remainder;

  return {
    totalPoolMinor,
    fiveMatchPoolMinor: finalFiveMatchPoolMinor,
    fourMatchPoolMinor,
    threeMatchPoolMinor,
    jackpotRolloverOutMinor: 0, // Will be updated when winners are calculated
    distribution: {
      fiveMatchPercent: PRIZE_DISTRIBUTION.fiveMatch,
      fourMatchPercent: PRIZE_DISTRIBUTION.fourMatch,
      threeMatchPercent: PRIZE_DISTRIBUTION.threeMatch,
    },
  };
}

/**
 * Calculate winners and prize amounts
 * 
 * ALGORITHM (Implementation Decision):
 * 1. For each tier, divide the tier pool by the number of winners
 * 2. Use integer division (floor) to ensure no fractional pennies
 * 3. Remainder from division is added to the first winner in the tier (deterministic)
 * 4. If no winners in 5-match tier, the entire 5-match pool rolls over
 * 5. 4-match and 3-match pools do NOT roll over (remainder stays in platform)
 * 
 * Uses integer minor currency units exclusively.
 * Currency is hardcoded to GBP as an implementation decision (PRD does not specify).
 */
export function calculateWinners(
  prizePool: PrizePool,
  tierGroups: Map<MatchTier, Array<{ userId: string }>>
): { winners: Winner[]; updatedPrizePool: PrizePool } {
  const winners: Winner[] = [];

  // Process 5-match tier
  const fiveMatchEntries = tierGroups.get(5) || [];
  if (fiveMatchEntries.length > 0) {
    // There are winners - distribute the pool
    const prizePerWinner = Math.floor(prizePool.fiveMatchPoolMinor / fiveMatchEntries.length);
    const remainder = prizePool.fiveMatchPoolMinor - (prizePerWinner * fiveMatchEntries.length);
    
    fiveMatchEntries.forEach((entry, index) => {
      const prizeAmount = index === 0 ? prizePerWinner + remainder : prizePerWinner;
      winners.push({
        userId: entry.userId,
        tier: 5,
        prizeAmountMinor: prizeAmount,
        currency: 'GBP',
      });
    });
    
    // No rollover when there are winners
    prizePool.jackpotRolloverOutMinor = 0;
  } else {
    // No 5-match winners - entire pool rolls over
    prizePool.jackpotRolloverOutMinor = prizePool.fiveMatchPoolMinor;
  }

  // Process 4-match tier (no rollover)
  const fourMatchEntries = tierGroups.get(4) || [];
  if (fourMatchEntries.length > 0) {
    const prizePerWinner = Math.floor(prizePool.fourMatchPoolMinor / fourMatchEntries.length);
    const remainder = prizePool.fourMatchPoolMinor - (prizePerWinner * fourMatchEntries.length);
    
    fourMatchEntries.forEach((entry, index) => {
      const prizeAmount = index === 0 ? prizePerWinner + remainder : prizePerWinner;
      winners.push({
        userId: entry.userId,
        tier: 4,
        prizeAmountMinor: prizeAmount,
        currency: 'GBP',
      });
    });
  }
  // If no 4-match winners, the pool stays with the platform (not rolled over)

  // Process 3-match tier (no rollover)
  const threeMatchEntries = tierGroups.get(3) || [];
  if (threeMatchEntries.length > 0) {
    const prizePerWinner = Math.floor(prizePool.threeMatchPoolMinor / threeMatchEntries.length);
    const remainder = prizePool.threeMatchPoolMinor - (prizePerWinner * threeMatchEntries.length);
    
    threeMatchEntries.forEach((entry, index) => {
      const prizeAmount = index === 0 ? prizePerWinner + remainder : prizePerWinner;
      winners.push({
        userId: entry.userId,
        tier: 3,
        prizeAmountMinor: prizeAmount,
        currency: 'GBP',
      });
    });
  }
  // If no 3-match winners, the pool stays with the platform (not rolled over)

  return { winners, updatedPrizePool: prizePool };
}

/**
 * Format minor currency units to display string
 */
export function formatCurrency(amountMinor: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}
