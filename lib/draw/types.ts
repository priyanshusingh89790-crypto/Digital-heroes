// Draw engine types - independent of UI and database

export type DrawType = 'random' | 'algorithmic';
export type DrawStatus = 'draft' | 'simulated' | 'published' | 'archived' | 'cancelled';
export type MatchTier = 3 | 4 | 5;

export interface DrawNumberRange {
  min: number;
  max: number;
}

export interface DrawConfig {
  type: DrawType;
  numberRange: DrawNumberRange;
  count: number; // Number of draw numbers to generate (default 5)
}

export interface DrawResult {
  numbers: number[];
  type: DrawType;
  metadata: {
    seed?: string; // For deterministic algorithmic draws
    algorithmVersion: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

export interface DrawEntry {
  userId: string;
  selectedNumbers: number[];
  scoreSnapshot: number[]; // User's golf scores at time of entry
}

export interface MatchResult {
  entryId: string;
  userId: string;
  matchedCount: number;
  matchedNumbers: number[];
  tier: MatchTier | null;
}

export interface PrizePoolConfig {
  currency: string;
  contributionPercentage: number; // Percentage of subscription that goes to prize pool
  activeSubscriberCount: number;
  subscriptionAmountMinor: number; // Per-subscription contribution in minor units
  jackpotRolloverInMinor: number; // Previous unclaimed jackpot
}

export interface PrizePool {
  totalPoolMinor: number;
  fiveMatchPoolMinor: number;
  fourMatchPoolMinor: number;
  threeMatchPoolMinor: number;
  jackpotRolloverOutMinor: number;
  distribution: {
    fiveMatchPercent: number;
    fourMatchPercent: number;
    threeMatchPercent: number;
  };
}

export interface Winner {
  userId: string;
  tier: MatchTier;
  prizeAmountMinor: number;
  currency: string;
}

export interface DrawSimulation {
  drawResult: DrawResult;
  matches: MatchResult[];
  prizePool: PrizePool;
  winners: Winner[];
  eligibleParticipants: number;
}

export interface ScoreFrequency {
  score: number;
  frequency: number;
  weight: number;
}

// Algorithmic draw configuration
export interface AlgorithmicConfig {
  type: 'algorithmic'; // Explicit type for type safety
  scoreFrequencies: ScoreFrequency[];
  numberRange: DrawNumberRange;
  count: number;
  seed?: string; // Optional seed for reproducibility
}
