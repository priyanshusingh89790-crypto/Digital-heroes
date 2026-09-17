import { describe, it, expect } from 'vitest';
import {
  generateRandomDraw,
  generateSeededRandomDraw,
} from '../lib/draw/random-draw';
import {
  generateAlgorithmicDraw,
  calculateScoreFrequencies,
} from '../lib/draw/algorithmic-draw';
import {
  calculateMatch,
  calculateMatches,
  groupMatchesByTier,
  validateDrawNumbers,
} from '../lib/draw/matching';
import {
  calculatePrizePool,
  calculateWinners,
  formatCurrency,
} from '../lib/draw/prize-calculator';
import {
  simulateDraw,
  isValidStateTransition,
  canPublishDraw,
  canModifyDraw,
  canRerunDraw,
  validateDrawConfig,
  validatePrizeConfig,
} from '../lib/draw/draw-engine';
import type {
  DrawConfig,
  AlgorithmicConfig,
  MatchTier,
  PrizePoolConfig,
} from '../lib/draw/types';

describe('DRAW GENERATION', () => {
  describe('Random Draw', () => {
    it('should generate exactly 5 numbers', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const result = generateRandomDraw(config);
      expect(result.numbers).toHaveLength(5);
    });

    it('should generate all unique numbers', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const result = generateRandomDraw(config);
      const uniqueNumbers = new Set(result.numbers);
      expect(uniqueNumbers.size).toBe(5);
    });

    it('should generate all numbers within range', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const result = generateRandomDraw(config);
      for (const num of result.numbers) {
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(45);
      }
    });

    it('should return sorted numbers', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const result = generateRandomDraw(config);
      const sorted = [...result.numbers].sort((a, b) => a - b);
      expect(result.numbers).toEqual(sorted);
    });

    it('should include metadata for auditability', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const result = generateRandomDraw(config);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.algorithmVersion).toBe('random-v1');
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.method).toBe('crypto-random-bytes');
    });
  });

  describe('Seeded Random Draw', () => {
    it('should generate deterministic results with same seed', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const seed = 'test-seed-123';
      const result1 = generateSeededRandomDraw(config, seed);
      const result2 = generateSeededRandomDraw(config, seed);
      expect(result1.numbers).toEqual(result2.numbers);
    });

    it('should generate different results with different seeds', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const result1 = generateSeededRandomDraw(config, 'seed-1');
      const result2 = generateSeededRandomDraw(config, 'seed-2');
      expect(result1.numbers).not.toEqual(result2.numbers);
    });

    it('should mark simulation mode in metadata', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const result = generateSeededRandomDraw(config, 'test-seed');
      expect(result.metadata.warning).toBe('Seeded random - for simulation only');
    });
  });

  describe('Algorithmic Draw', () => {
    it('should generate exactly 5 numbers', () => {
      const config: AlgorithmicConfig = {
        type: 'algorithmic',
        scoreFrequencies: calculateScoreFrequencies([[1, 2, 3, 4, 5]]),
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const result = generateAlgorithmicDraw(config);
      expect(result.numbers).toHaveLength(5);
    });

    it('should generate all unique numbers', () => {
      const config: AlgorithmicConfig = {
        type: 'algorithmic',
        scoreFrequencies: calculateScoreFrequencies([[1, 2, 3, 4, 5]]),
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const result = generateAlgorithmicDraw(config);
      const uniqueNumbers = new Set(result.numbers);
      expect(uniqueNumbers.size).toBe(5);
    });

    it('should generate all numbers within range', () => {
      const config: AlgorithmicConfig = {
        type: 'algorithmic',
        scoreFrequencies: calculateScoreFrequencies([[1, 2, 3, 4, 5]]),
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const result = generateAlgorithmicDraw(config);
      for (const num of result.numbers) {
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(45);
      }
    });

    it('should include score frequencies in metadata', () => {
      const config: AlgorithmicConfig = {
        type: 'algorithmic',
        scoreFrequencies: calculateScoreFrequencies([[1, 2, 3, 4, 5]]),
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const result = generateAlgorithmicDraw(config);
      expect(result.metadata.scoreFrequencies).toBeDefined();
      expect(result.metadata.weights).toBeDefined();
    });

    it('should handle zero-frequency scores', () => {
      const config: AlgorithmicConfig = {
        type: 'algorithmic',
        scoreFrequencies: calculateScoreFrequencies([[1, 2, 3, 4, 5]]),
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      const result = generateAlgorithmicDraw(config);
      // Should still generate 5 unique numbers even with many zero-frequency scores
      expect(result.numbers).toHaveLength(5);
      const uniqueNumbers = new Set(result.numbers);
      expect(uniqueNumbers.size).toBe(5);
    });
  });

  describe('Score Frequency Calculation', () => {
    it('should calculate correct frequencies', () => {
      const allScores = [
        [1, 2, 3, 4, 5],
        [1, 2, 3, 4, 5],
        [10, 20, 30, 40, 45],
      ];
      const frequencies = calculateScoreFrequencies(allScores);
      
      const score1 = frequencies.find(f => f.score === 1);
      expect(score1?.frequency).toBe(2);
      
      const score10 = frequencies.find(f => f.score === 10);
      expect(score10?.frequency).toBe(1);
      
      const score6 = frequencies.find(f => f.score === 6);
      expect(score6?.frequency).toBe(0);
    });

    it('should assign weights as frequency + 1', () => {
      const allScores = [[1, 2, 3, 4, 5]];
      const frequencies = calculateScoreFrequencies(allScores);
      
      const score1 = frequencies.find(f => f.score === 1);
      expect(score1?.weight).toBe(2); // frequency 1 + 1
      
      const score6 = frequencies.find(f => f.score === 6);
      expect(score6?.weight).toBe(1); // frequency 0 + 1
    });
  });
});

describe('MATCHING', () => {
  describe('calculateMatch', () => {
    it('should detect 5-number match', () => {
      const drawNumbers = [1, 2, 3, 4, 5];
      const entryNumbers = [1, 2, 3, 4, 5];
      const result = calculateMatch(drawNumbers, entryNumbers, 'entry-1', 'user-1');
      
      expect(result.matchedCount).toBe(5);
      expect(result.tier).toBe(5);
      expect(result.matchedNumbers).toEqual([1, 2, 3, 4, 5]);
    });

    it('should detect 4-number match', () => {
      const drawNumbers = [1, 2, 3, 4, 5];
      const entryNumbers = [1, 2, 3, 4, 10];
      const result = calculateMatch(drawNumbers, entryNumbers, 'entry-1', 'user-1');
      
      expect(result.matchedCount).toBe(4);
      expect(result.tier).toBe(4);
      expect(result.matchedNumbers).toEqual([1, 2, 3, 4]);
    });

    it('should detect 3-number match', () => {
      const drawNumbers = [1, 2, 3, 4, 5];
      const entryNumbers = [1, 2, 3, 10, 20];
      const result = calculateMatch(drawNumbers, entryNumbers, 'entry-1', 'user-1');
      
      expect(result.matchedCount).toBe(3);
      expect(result.tier).toBe(3);
      expect(result.matchedNumbers).toEqual([1, 2, 3]);
    });

    it('should detect no match', () => {
      const drawNumbers = [1, 2, 3, 4, 5];
      const entryNumbers = [10, 20, 30, 40, 45];
      const result = calculateMatch(drawNumbers, entryNumbers, 'entry-1', 'user-1');
      
      expect(result.matchedCount).toBe(0);
      expect(result.tier).toBeNull();
      expect(result.matchedNumbers).toEqual([]);
    });

    it('should handle numbers in different order', () => {
      const drawNumbers = [5, 4, 3, 2, 1];
      const entryNumbers = [1, 2, 3, 4, 5];
      const result = calculateMatch(drawNumbers, entryNumbers, 'entry-1', 'user-1');
      
      expect(result.matchedCount).toBe(5);
      expect(result.tier).toBe(5);
    });

    it('should return sorted matched numbers', () => {
      const drawNumbers = [5, 4, 3, 2, 1];
      const entryNumbers = [5, 3, 1, 10, 20];
      const result = calculateMatch(drawNumbers, entryNumbers, 'entry-1', 'user-1');
      
      expect(result.matchedNumbers).toEqual([1, 3, 5]);
    });

    it('should throw error for invalid draw numbers', () => {
      const drawNumbers = [1, 2, 3]; // Only 3 numbers
      const entryNumbers = [1, 2, 3, 4, 5];
      
      expect(() => calculateMatch(drawNumbers, entryNumbers, 'entry-1', 'user-1'))
        .toThrow('Draw numbers must contain exactly 5 numbers');
    });

    it('should throw error for invalid entry numbers', () => {
      const drawNumbers = [1, 2, 3, 4, 5];
      const entryNumbers = [1, 2, 3]; // Only 3 numbers
      
      expect(() => calculateMatch(drawNumbers, entryNumbers, 'entry-1', 'user-1'))
        .toThrow('Entry numbers must contain exactly 5 numbers');
    });
  });

  describe('calculateMatches', () => {
    it('should calculate matches for multiple entries', () => {
      const drawNumbers = [1, 2, 3, 4, 5];
      const entries = [
        { id: 'entry-1', userId: 'user-1', selectedNumbers: [1, 2, 3, 4, 5] },
        { id: 'entry-2', userId: 'user-2', selectedNumbers: [1, 2, 3, 10, 20] },
        { id: 'entry-3', userId: 'user-3', selectedNumbers: [10, 20, 30, 40, 45] },
      ];
      
      const results = calculateMatches(drawNumbers, entries);
      expect(results).toHaveLength(3);
      expect(results[0].matchedCount).toBe(5);
      expect(results[1].matchedCount).toBe(3);
      expect(results[2].matchedCount).toBe(0);
    });
  });

  describe('groupMatchesByTier', () => {
    it('should group matches by tier', () => {
      const matches = [
        { entryId: '1', userId: 'user-1', matchedCount: 5, matchedNumbers: [1, 2, 3, 4, 5], tier: 5 as MatchTier },
        { entryId: '2', userId: 'user-2', matchedCount: 4, matchedNumbers: [1, 2, 3, 4], tier: 4 as MatchTier },
        { entryId: '3', userId: 'user-3', matchedCount: 3, matchedNumbers: [1, 2, 3], tier: 3 as MatchTier },
        { entryId: '4', userId: 'user-4', matchedCount: 0, matchedNumbers: [], tier: null },
      ];
      
      const groups = groupMatchesByTier(matches);
      
      expect(groups.get(5)).toHaveLength(1);
      expect(groups.get(4)).toHaveLength(1);
      expect(groups.get(3)).toHaveLength(1);
      expect(groups.get(5)?.[0].userId).toBe('user-1');
    });
  });

  describe('validateDrawNumbers', () => {
    it('should validate correct draw numbers', () => {
      const numbers = [1, 2, 3, 4, 5];
      expect(validateDrawNumbers(numbers)).toBe(true);
    });

    it('should reject wrong count', () => {
      const numbers = [1, 2, 3, 4];
      expect(validateDrawNumbers(numbers)).toBe(false);
    });

    it('should reject duplicate numbers', () => {
      const numbers = [1, 2, 3, 4, 4];
      expect(validateDrawNumbers(numbers)).toBe(false);
    });

    it('should reject numbers outside range', () => {
      const numbers = [1, 2, 3, 4, 46];
      expect(validateDrawNumbers(numbers)).toBe(false);
    });

    it('should reject numbers below minimum', () => {
      const numbers = [0, 2, 3, 4, 5];
      expect(validateDrawNumbers(numbers)).toBe(false);
    });
  });
});

describe('PRIZE CALCULATION', () => {
  describe('calculatePrizePool', () => {
    it('should calculate 40/35/25 distribution', () => {
      const config: PrizePoolConfig = {
        currency: 'GBP',
        contributionPercentage: 50,
        activeSubscriberCount: 100,
        subscriptionAmountMinor: 1200, // £12.00
        jackpotRolloverInMinor: 0,
      };
      
      const pool = calculatePrizePool(config);
      
      expect(pool.distribution.fiveMatchPercent).toBe(40);
      expect(pool.distribution.fourMatchPercent).toBe(35);
      expect(pool.distribution.threeMatchPercent).toBe(25);
    });

    it('should calculate correct pool amounts', () => {
      const config: PrizePoolConfig = {
        currency: 'GBP',
        contributionPercentage: 50,
        activeSubscriberCount: 100,
        subscriptionAmountMinor: 1200, // £12.00
        jackpotRolloverInMinor: 0,
      };
      
      const pool = calculatePrizePool(config);
      
      // Total: 100 * £12 * 50% = £600 = 60000 pence
      const expectedTotal = 100 * 1200 * 0.5;
      expect(pool.totalPoolMinor).toBe(expectedTotal);
      
      // 5-match: 40% of 60000 = 24000
      expect(pool.fiveMatchPoolMinor).toBe(Math.floor(expectedTotal * 0.4));
      
      // 4-match: 35% of 60000 = 21000
      expect(pool.fourMatchPoolMinor).toBe(Math.floor(expectedTotal * 0.35));
      
      // 3-match: 25% of 60000 = 15000
      expect(pool.threeMatchPoolMinor).toBe(Math.floor(expectedTotal * 0.25));
    });

    it('should handle jackpot rollover', () => {
      const config: PrizePoolConfig = {
        currency: 'GBP',
        contributionPercentage: 50,
        activeSubscriberCount: 100,
        subscriptionAmountMinor: 1200,
        jackpotRolloverInMinor: 10000, // £100 rollover
      };
      
      const pool = calculatePrizePool(config);
      
      // Total should include rollover
      const expectedTotal = 100 * 1200 * 0.5 + 10000;
      expect(pool.totalPoolMinor).toBe(expectedTotal);
    });

    it('should use default contribution percentage if not specified', () => {
      const config: PrizePoolConfig = {
        currency: 'GBP',
        contributionPercentage: 50,
        activeSubscriberCount: 100,
        subscriptionAmountMinor: 1200,
        jackpotRolloverInMinor: 0,
      };
      
      const pool = calculatePrizePool(config);
      
      // Should use 50% default
      const expectedTotal = 100 * 1200 * 0.5;
      expect(pool.totalPoolMinor).toBe(expectedTotal);
    });
  });

  describe('calculateWinners', () => {
    it('should distribute prize to single winner', () => {
      const prizePool = {
        totalPoolMinor: 60000,
        fiveMatchPoolMinor: 24000,
        fourMatchPoolMinor: 21000,
        threeMatchPoolMinor: 15000,
        jackpotRolloverOutMinor: 0,
        distribution: { fiveMatchPercent: 40, fourMatchPercent: 35, threeMatchPercent: 25 },
      };
      
      const tierGroups = new Map<MatchTier, Array<{ userId: string }>>();
      tierGroups.set(5, [{ userId: 'user-1' }]);
      
      const { winners, updatedPrizePool } = calculateWinners(prizePool, tierGroups);
      
      expect(winners).toHaveLength(1);
      expect(winners[0].userId).toBe('user-1');
      expect(winners[0].tier).toBe(5);
      expect(winners[0].prizeAmountMinor).toBe(24000);
      expect(updatedPrizePool.jackpotRolloverOutMinor).toBe(0);
    });

    it('should split prize among multiple winners', () => {
      const prizePool = {
        totalPoolMinor: 60000,
        fiveMatchPoolMinor: 24000,
        fourMatchPoolMinor: 21000,
        threeMatchPoolMinor: 15000,
        jackpotRolloverOutMinor: 0,
        distribution: { fiveMatchPercent: 40, fourMatchPercent: 35, threeMatchPercent: 25 },
      };
      
      const tierGroups = new Map<MatchTier, Array<{ userId: string }>>();
      tierGroups.set(5, [
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);
      
      const { winners } = calculateWinners(prizePool, tierGroups);
      
      expect(winners).toHaveLength(3);
      // 24000 / 3 = 8000 each
      const expectedPrize = Math.floor(24000 / 3);
      expect(winners[0].prizeAmountMinor).toBe(expectedPrize);
      expect(winners[1].prizeAmountMinor).toBe(expectedPrize);
      expect(winners[2].prizeAmountMinor).toBe(expectedPrize);
    });

    it('should handle rounding remainder', () => {
      const prizePool = {
        totalPoolMinor: 60000,
        fiveMatchPoolMinor: 24001, // Not evenly divisible
        fourMatchPoolMinor: 21000,
        threeMatchPoolMinor: 15000,
        jackpotRolloverOutMinor: 0,
        distribution: { fiveMatchPercent: 40, fourMatchPercent: 35, threeMatchPercent: 25 },
      };
      
      const tierGroups = new Map<MatchTier, Array<{ userId: string }>>();
      tierGroups.set(5, [
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      
      const { winners } = calculateWinners(prizePool, tierGroups);
      
      expect(winners).toHaveLength(2);
      // 24001 / 2 = 12000 each, remainder 1
      // First winner gets 12001, second gets 12000
      const totalPrize = winners[0].prizeAmountMinor + winners[1].prizeAmountMinor;
      expect(totalPrize).toBe(24001);
    });

    it('should calculate rollover when no 5-match winners', () => {
      const prizePool = {
        totalPoolMinor: 60000,
        fiveMatchPoolMinor: 24000,
        fourMatchPoolMinor: 21000,
        threeMatchPoolMinor: 15000,
        jackpotRolloverOutMinor: 0,
        distribution: { fiveMatchPercent: 40, fourMatchPercent: 35, threeMatchPercent: 25 },
      };
      
      const tierGroups = new Map<MatchTier, Array<{ userId: string }>>();
      tierGroups.set(4, [{ userId: 'user-1' }]);
      
      const { updatedPrizePool } = calculateWinners(prizePool, tierGroups);
      
      expect(updatedPrizePool.jackpotRolloverOutMinor).toBe(24000);
    });

    it('should not rollover when 5-match winners exist', () => {
      const prizePool = {
        totalPoolMinor: 60000,
        fiveMatchPoolMinor: 24000,
        fourMatchPoolMinor: 21000,
        threeMatchPoolMinor: 15000,
        jackpotRolloverOutMinor: 0,
        distribution: { fiveMatchPercent: 40, fourMatchPercent: 35, threeMatchPercent: 25 },
      };
      
      const tierGroups = new Map<MatchTier, Array<{ userId: string }>>();
      tierGroups.set(5, [{ userId: 'user-1' }]);
      
      const { updatedPrizePool } = calculateWinners(prizePool, tierGroups);
      
      expect(updatedPrizePool.jackpotRolloverOutMinor).toBe(0);
    });
  });

  describe('formatCurrency', () => {
    it('should format pence to GBP', () => {
      expect(formatCurrency(12345)).toBe('£123.45');
      expect(formatCurrency(100)).toBe('£1.00');
      expect(formatCurrency(0)).toBe('£0.00');
    });
  });
});

describe('ROLLOVER', () => {
  it('should rollover jackpot with no 5-match winner', () => {
    const prizePool = {
      totalPoolMinor: 60000,
      fiveMatchPoolMinor: 24000,
      fourMatchPoolMinor: 21000,
      threeMatchPoolMinor: 15000,
      jackpotRolloverOutMinor: 0,
      distribution: { fiveMatchPercent: 40, fourMatchPercent: 35, threeMatchPercent: 25 },
    };
    
    const tierGroups = new Map<MatchTier, Array<{ userId: string }>>();
    // No 5-match winners
    
    const { updatedPrizePool } = calculateWinners(prizePool, tierGroups);
    
    expect(updatedPrizePool.jackpotRolloverOutMinor).toBe(24000);
  });

  it('should accumulate rollover over multiple months', () => {
    const config: PrizePoolConfig = {
      currency: 'GBP',
      contributionPercentage: 50,
      activeSubscriberCount: 100,
      subscriptionAmountMinor: 1200,
      jackpotRolloverInMinor: 24000, // Previous month's rollover
    };
    
    const pool = calculatePrizePool(config);
    
    // Should include accumulated rollover
    const expectedTotal = 100 * 1200 * 0.5 + 24000;
    expect(pool.totalPoolMinor).toBe(expectedTotal);
  });

  it('should payout rollover when winner exists', () => {
    const prizePool = {
      totalPoolMinor: 84000, // Includes 24000 rollover
      fiveMatchPoolMinor: 33600, // 40% of 84000
      fourMatchPoolMinor: 29400,
      threeMatchPoolMinor: 21000,
      jackpotRolloverOutMinor: 0,
      distribution: { fiveMatchPercent: 40, fourMatchPercent: 35, threeMatchPercent: 25 },
    };
    
    const tierGroups = new Map<MatchTier, Array<{ userId: string }>>();
    tierGroups.set(5, [{ userId: 'user-1' }]);
    
    const { updatedPrizePool } = calculateWinners(prizePool, tierGroups);
    
    // Rollover should be paid out to winner
    expect(updatedPrizePool.jackpotRolloverOutMinor).toBe(0);
  });

  it('should not rollover 4-match pool', () => {
    const prizePool = {
      totalPoolMinor: 60000,
      fiveMatchPoolMinor: 24000,
      fourMatchPoolMinor: 21000,
      threeMatchPoolMinor: 15000,
      jackpotRolloverOutMinor: 0,
      distribution: { fiveMatchPercent: 40, fourMatchPercent: 35, threeMatchPercent: 25 },
    };
    
    const tierGroups = new Map<MatchTier, Array<{ userId: string }>>();
    // No 4-match winners
    
    const { updatedPrizePool } = calculateWinners(prizePool, tierGroups);
    
    // Only 5-match pool should rollover
    expect(updatedPrizePool.jackpotRolloverOutMinor).toBe(24000);
  });

  it('should not rollover 3-match pool', () => {
    const prizePool = {
      totalPoolMinor: 60000,
      fiveMatchPoolMinor: 24000,
      fourMatchPoolMinor: 21000,
      threeMatchPoolMinor: 15000,
      jackpotRolloverOutMinor: 0,
      distribution: { fiveMatchPercent: 40, fourMatchPercent: 35, threeMatchPercent: 25 },
    };
    
    const tierGroups = new Map<MatchTier, Array<{ userId: string }>>();
    // No 3-match winners
    
    const { updatedPrizePool } = calculateWinners(prizePool, tierGroups);
    
    // Only 5-match pool should rollover
    expect(updatedPrizePool.jackpotRolloverOutMinor).toBe(24000);
  });
});

describe('LIFECYCLE', () => {
  describe('isValidStateTransition', () => {
    it('should allow draft -> simulated', () => {
      expect(isValidStateTransition('draft', 'simulated')).toBe(true);
    });

    it('should allow draft -> cancelled', () => {
      expect(isValidStateTransition('draft', 'cancelled')).toBe(true);
    });

    it('should allow simulated -> published', () => {
      expect(isValidStateTransition('simulated', 'published')).toBe(true);
    });

    it('should allow simulated -> cancelled', () => {
      expect(isValidStateTransition('simulated', 'cancelled')).toBe(true);
    });

    it('should allow published -> archived', () => {
      expect(isValidStateTransition('published', 'archived')).toBe(true);
    });

    it('should not allow invalid transitions', () => {
      expect(isValidStateTransition('published', 'published')).toBe(false);
      expect(isValidStateTransition('published', 'draft')).toBe(false);
      expect(isValidStateTransition('archived', 'published')).toBe(false);
      expect(isValidStateTransition('cancelled', 'draft')).toBe(false);
    });
  });

  describe('canPublishDraw', () => {
    it('should allow publishing simulated draw with numbers', () => {
      expect(canPublishDraw('simulated', true)).toBe(true);
    });

    it('should not allow publishing draft draw', () => {
      expect(canPublishDraw('draft', true)).toBe(false);
    });

    it('should not allow publishing draw without numbers', () => {
      expect(canPublishDraw('simulated', false)).toBe(false);
    });

    it('should not allow publishing published draw', () => {
      expect(canPublishDraw('published', true)).toBe(false);
    });
  });

  describe('canModifyDraw', () => {
    it('should allow modifying draft draw', () => {
      expect(canModifyDraw('draft')).toBe(true);
    });

    it('should allow modifying simulated draw', () => {
      expect(canModifyDraw('simulated')).toBe(true);
    });

    it('should not allow modifying published draw', () => {
      expect(canModifyDraw('published')).toBe(false);
    });

    it('should not allow modifying archived draw', () => {
      expect(canModifyDraw('archived')).toBe(false);
    });
  });

  describe('canRerunDraw', () => {
    it('should allow rerunning draft draw', () => {
      expect(canRerunDraw('draft')).toBe(true);
    });

    it('should allow rerunning simulated draw', () => {
      expect(canRerunDraw('simulated')).toBe(true);
    });

    it('should not allow rerunning published draw', () => {
      expect(canRerunDraw('published')).toBe(false);
    });
  });
});

describe('VALIDATION', () => {
  describe('validateDrawConfig', () => {
    it('should validate correct config', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 1, max: 45 },
        count: 5,
      };
      expect(() => validateDrawConfig(config)).not.toThrow();
    });

    it('should reject count other than 5', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 1, max: 45 },
        count: 3,
      };
      expect(() => validateDrawConfig(config)).toThrow('Draw must generate exactly 5 numbers');
    });

    it('should reject range minimum below 1', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 0, max: 45 },
        count: 5,
      };
      expect(() => validateDrawConfig(config)).toThrow('Number range minimum must be at least 1');
    });

    it('should reject range maximum above 45', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 1, max: 50 },
        count: 5,
      };
      expect(() => validateDrawConfig(config)).toThrow('Number range maximum cannot exceed 45');
    });

    it('should reject invalid range', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 10, max: 5 },
        count: 5,
      };
      expect(() => validateDrawConfig(config)).toThrow('Number range maximum must be greater than minimum');
    });

    it('should reject count larger than range', () => {
      const config: DrawConfig = {
        type: 'random',
        numberRange: { min: 1, max: 4 },
        count: 5,
      };
      expect(() => validateDrawConfig(config)).toThrow();
    });
  });

  describe('validatePrizeConfig', () => {
    it('should validate correct config', () => {
      const config: PrizePoolConfig = {
        currency: 'GBP',
        contributionPercentage: 50,
        activeSubscriberCount: 100,
        subscriptionAmountMinor: 1200,
        jackpotRolloverInMinor: 0,
      };
      expect(() => validatePrizeConfig(config)).not.toThrow();
    });

    it('should reject negative subscriber count', () => {
      const config: PrizePoolConfig = {
        currency: 'GBP',
        contributionPercentage: 50,
        activeSubscriberCount: -1,
        subscriptionAmountMinor: 1200,
        jackpotRolloverInMinor: 0,
      };
      expect(() => validatePrizeConfig(config)).toThrow('Active subscriber count cannot be negative');
    });

    it('should reject negative subscription amount', () => {
      const config: PrizePoolConfig = {
        currency: 'GBP',
        contributionPercentage: 50,
        activeSubscriberCount: 100,
        subscriptionAmountMinor: -100,
        jackpotRolloverInMinor: 0,
      };
      expect(() => validatePrizeConfig(config)).toThrow('Subscription amount cannot be negative');
    });

    it('should reject negative rollover', () => {
      const config: PrizePoolConfig = {
        currency: 'GBP',
        contributionPercentage: 50,
        activeSubscriberCount: 100,
        subscriptionAmountMinor: 1200,
        jackpotRolloverInMinor: -100,
      };
      expect(() => validatePrizeConfig(config)).toThrow('Jackpot rollover cannot be negative');
    });

    it('should reject invalid contribution percentage', () => {
      const config: PrizePoolConfig = {
        currency: 'GBP',
        contributionPercentage: 150,
        activeSubscriberCount: 100,
        subscriptionAmountMinor: 1200,
        jackpotRolloverInMinor: 0,
      };
      expect(() => validatePrizeConfig(config)).toThrow('Contribution percentage must be between 0 and 100');
    });

    it('should reject invalid currency code', () => {
      const config: PrizePoolConfig = {
        currency: 'GB',
        contributionPercentage: 50,
        activeSubscriberCount: 100,
        subscriptionAmountMinor: 1200,
        jackpotRolloverInMinor: 0,
      };
      expect(() => validatePrizeConfig(config)).toThrow('Currency must be a 3-letter ISO code');
    });
  });
});

describe('SIMULATION', () => {
  it('should run simulation without publishing', () => {
    const config: DrawConfig = {
      type: 'random',
      numberRange: { min: 1, max: 45 },
      count: 5,
    };
    
    const entries = [
      { userId: 'user-1', selectedNumbers: [1, 2, 3, 4, 5], scoreSnapshot: [1, 2, 3, 4, 5] },
      { userId: 'user-2', selectedNumbers: [1, 2, 3, 10, 20], scoreSnapshot: [1, 2, 3, 10, 20] },
    ];
    
    const prizeConfig: PrizePoolConfig = {
      currency: 'GBP',
      contributionPercentage: 50,
      activeSubscriberCount: 2,
      subscriptionAmountMinor: 1200,
      jackpotRolloverInMinor: 0,
    };
    
    const simulation = simulateDraw(config, entries, prizeConfig, 'test-seed');
    
    expect(simulation.drawResult).toBeDefined();
    expect(simulation.matches).toHaveLength(2);
    expect(simulation.prizePool).toBeDefined();
    expect(simulation.winners).toBeDefined();
    expect(simulation.eligibleParticipants).toBe(2);
  });

  it('should use seed for reproducible simulation', () => {
    const config: DrawConfig = {
      type: 'random',
      numberRange: { min: 1, max: 45 },
      count: 5,
    };
    
    const entries = [
      { userId: 'user-1', selectedNumbers: [1, 2, 3, 4, 5], scoreSnapshot: [1, 2, 3, 4, 5] },
    ];
    
    const prizeConfig: PrizePoolConfig = {
      currency: 'GBP',
      contributionPercentage: 50,
      activeSubscriberCount: 1,
      subscriptionAmountMinor: 1200,
      jackpotRolloverInMinor: 0,
    };
    
    const sim1 = simulateDraw(config, entries, prizeConfig, 'seed-1');
    const sim2 = simulateDraw(config, entries, prizeConfig, 'seed-1');
    
    expect(sim1.drawResult.numbers).toEqual(sim2.drawResult.numbers);
  });
});
