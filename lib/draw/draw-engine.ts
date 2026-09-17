import type {
  DrawConfig,
  DrawResult,
  DrawEntry,
  PrizePoolConfig,
  DrawSimulation,
  AlgorithmicConfig,
  DrawStatus,
} from './types';
import { generateRandomDraw, generateSeededRandomDraw } from './random-draw';
import { generateAlgorithmicDraw, calculateScoreFrequencies } from './algorithmic-draw';
import { calculateMatches, groupMatchesByTier } from './matching';
import { calculatePrizePool, calculateWinners } from './prize-calculator';

/**
 * Main draw engine orchestrator
 * Coordinates draw generation, matching, and prize calculation
 * Independent of UI and database - pure business logic
 */

/**
 * Generate a draw result based on configuration
 */
export function generateDraw(
  config: DrawConfig | AlgorithmicConfig,
  seed?: string
): DrawResult {
  if (config.type === 'random') {
    return seed
      ? generateSeededRandomDraw(config as DrawConfig, seed)
      : generateRandomDraw(config as DrawConfig);
  } else {
    return generateAlgorithmicDraw(config as AlgorithmicConfig);
  }
}

/**
 * Run a complete draw simulation
 * Does not persist to database - for admin preview only
 */
export function simulateDraw(
  config: DrawConfig | AlgorithmicConfig,
  entries: DrawEntry[],
  prizeConfig: PrizePoolConfig,
  seed?: string
): DrawSimulation {
  // Generate draw numbers
  const drawResult = generateDraw(config, seed);

  // Calculate matches
  const matches = calculateMatches(
    drawResult.numbers,
    entries.map(e => ({
      id: e.userId, // Using userId as entryId for simulation
      userId: e.userId,
      selectedNumbers: e.selectedNumbers,
    }))
  );

  // Group matches by tier
  const tierGroups = groupMatchesByTier(matches);

  // Calculate prize pool
  const prizePool = calculatePrizePool(prizeConfig);

  // Calculate winners
  const { winners } = calculateWinners(prizePool, tierGroups);

  return {
    drawResult,
    matches,
    prizePool,
    winners,
    eligibleParticipants: entries.length,
  };
}

/**
 * Validate draw state transitions
 * Prevents invalid state changes
 */
export function isValidStateTransition(
  currentStatus: DrawStatus,
  newStatus: DrawStatus
): boolean {
  const validTransitions: Record<DrawStatus, DrawStatus[]> = {
    draft: ['simulated', 'cancelled'],
    simulated: ['published', 'cancelled'],
    published: ['archived'],
    archived: [],
    cancelled: [],
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

/**
 * Validate that a draw can be published
 */
export function canPublishDraw(status: DrawStatus, hasNumbers: boolean): boolean {
  return status === 'simulated' && hasNumbers;
}

/**
 * Validate that a draw can be modified
 */
export function canModifyDraw(status: DrawStatus): boolean {
  return status === 'draft' || status === 'simulated';
}

/**
 * Validate that a draw can be rerun
 * Published draws can never be rerun
 */
export function canRerunDraw(status: DrawStatus): boolean {
  return status === 'draft' || status === 'simulated';
}

/**
 * Calculate score frequencies from user scores
 * Helper for algorithmic draw configuration
 */
export function prepareAlgorithmicConfig(
  allScores: number[][],
  numberRange: { min: number; max: number },
  count: number = 5,
  seed?: string
): AlgorithmicConfig {
  const scoreFrequencies = calculateScoreFrequencies(allScores);
  
  return {
    type: 'algorithmic',
    scoreFrequencies,
    numberRange,
    count,
    seed,
  };
}

/**
 * Validate draw configuration
 */
export function validateDrawConfig(config: DrawConfig): void {
  if (config.count !== 5) {
    throw new Error('Draw must generate exactly 5 numbers');
  }

  if (config.numberRange.min < 1) {
    throw new Error('Number range minimum must be at least 1');
  }

  if (config.numberRange.max > 45) {
    throw new Error('Number range maximum cannot exceed 45');
  }

  if (config.numberRange.max <= config.numberRange.min) {
    throw new Error('Number range maximum must be greater than minimum');
  }

  const rangeSize = config.numberRange.max - config.numberRange.min + 1;
  if (config.count > rangeSize) {
    throw new Error(
      `Cannot generate ${config.count} unique numbers from range of size ${rangeSize}`
    );
  }
}

/**
 * Validate prize pool configuration
 */
export function validatePrizeConfig(config: PrizePoolConfig): void {
  if (config.activeSubscriberCount < 0) {
    throw new Error('Active subscriber count cannot be negative');
  }

  if (config.subscriptionAmountMinor < 0) {
    throw new Error('Subscription amount cannot be negative');
  }

  if (config.jackpotRolloverInMinor < 0) {
    throw new Error('Jackpot rollover cannot be negative');
  }

  if (config.contributionPercentage <= 0 || config.contributionPercentage > 100) {
    throw new Error('Contribution percentage must be between 0 and 100');
  }

  if (config.currency.length !== 3) {
    throw new Error('Currency must be a 3-letter ISO code');
  }
}
