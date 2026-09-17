import crypto from 'crypto';
import type { AlgorithmicConfig, DrawResult, ScoreFrequency } from './types';

const ALGORITHM_VERSION = 'algorithmic-v1';

/**
 * Generate an algorithmic draw weighted by score frequency
 * 
 * ALGORITHM (Implementation Decision):
 * The PRD specifies weighting by score frequency but does not define the exact method.
 * 
 * 1. Calculate frequency of each score (1-45) across all eligible subscribers
 * 2. Map scores directly to draw numbers (1-45 range aligns with Stableford scores)
 * 3. Assign weight = frequency + 1 (implementation decision to handle zero-frequency scores)
 * 4. Use weighted random selection to pick 5 unique numbers
 * 5. Higher frequency = higher probability of selection
 * 
 * This is transparent, auditable, and deterministic when seeded.
 */
export function generateAlgorithmicDraw(config: AlgorithmicConfig): DrawResult {
  const { scoreFrequencies, numberRange, count, seed } = config;
  
  // Ensure type is algorithmic
  if (config.type !== 'algorithmic') {
    throw new Error('Invalid config type for algorithmic draw');
  }
  
  // Validate that score frequencies align with number range
  const frequencyMap = new Map<number, number>();
  scoreFrequencies.forEach(({ score, frequency }) => {
    if (score < numberRange.min || score > numberRange.max) {
      throw new Error(`Score ${score} outside number range ${numberRange.min}-${numberRange.max}`);
    }
    frequencyMap.set(score, frequency);
  });
  
  // Calculate weights (frequency + 1 to handle zero-frequency scores)
  const weights = new Map<number, number>();
  for (let i = numberRange.min; i <= numberRange.max; i++) {
    const frequency = frequencyMap.get(i) || 0;
    weights.set(i, frequency + 1); // +1 ensures all numbers have non-zero weight
  }
  
  // Generate weighted random selection
  const numbers = seed 
    ? generateWeightedSeededSelection(weights, count, seed, numberRange)
    : generateWeightedCryptoSelection(weights, count, numberRange);
  
  return {
    numbers: numbers.sort((a, b) => a - b),
    type: 'algorithmic',
    metadata: {
      algorithmVersion: ALGORITHM_VERSION,
      timestamp: new Date().toISOString(),
      numberRange,
      count,
      scoreFrequencies: Array.from(frequencyMap.entries()).map(([score, freq]) => ({ score, frequency: freq })),
      weights: Array.from(weights.entries()).map(([num, weight]) => ({ number: num, weight })),
      method: seed ? 'weighted-seeded' : 'weighted-crypto',
      ...(seed && { seed }),
    },
  };
}

/**
 * Generate weighted random selection using crypto for security
 */
function generateWeightedCryptoSelection(
  weights: Map<number, number>,
  count: number,
  range: { min: number; max: number }
): number[] {
  const numbers = new Set<number>();
  const rangeSize = range.max - range.min + 1;
  
  if (count > rangeSize) {
    throw new Error(`Cannot generate ${count} unique numbers from range of size ${rangeSize}`);
  }
  
  // Calculate total weight
  let totalWeight = 0;
  for (const weight of weights.values()) {
    totalWeight += weight;
  }
  
  // Create cumulative weight distribution
  const cumulativeWeights: { number: number; cumulativeWeight: number }[] = [];
  let cumulative = 0;
  for (let i = range.min; i <= range.max; i++) {
    cumulative += weights.get(i) || 0;
    cumulativeWeights.push({ number: i, cumulativeWeight: cumulative });
  }
  
  // Weighted random selection
  while (numbers.size < count) {
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0) / 0xFFFFFFFF;
    const selectedWeight = randomValue * totalWeight;
    
    // Find the number corresponding to the selected weight
    for (const { number, cumulativeWeight } of cumulativeWeights) {
      if (selectedWeight <= cumulativeWeight && !numbers.has(number)) {
        numbers.add(number);
        break;
      }
    }
  }
  
  return Array.from(numbers);
}

/**
 * Generate weighted random selection using seed for reproducibility
 * NOT cryptographically secure - for simulation only
 */
function generateWeightedSeededSelection(
  weights: Map<number, number>,
  count: number,
  seed: string,
  range: { min: number; max: number }
): number[] {
  const numbers = new Set<number>();
  const rangeSize = range.max - range.min + 1;
  
  if (count > rangeSize) {
    throw new Error(`Cannot generate ${count} unique numbers from range of size ${rangeSize}`);
  }
  
  // Calculate total weight
  let totalWeight = 0;
  for (const weight of weights.values()) {
    totalWeight += weight;
  }
  
  // Create cumulative weight distribution
  const cumulativeWeights: { number: number; cumulativeWeight: number }[] = [];
  let cumulative = 0;
  for (let i = range.min; i <= range.max; i++) {
    cumulative += weights.get(i) || 0;
    cumulativeWeights.push({ number: i, cumulativeWeight: cumulative });
  }
  
  // Seeded random selection
  let hash = simpleHash(seed);
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  
  while (numbers.size < count) {
    hash = (a * hash + c) % m;
    const randomValue = hash / m;
    const selectedWeight = randomValue * totalWeight;
    
    // Find the number corresponding to the selected weight
    for (const { number, cumulativeWeight } of cumulativeWeights) {
      if (selectedWeight <= cumulativeWeight && !numbers.has(number)) {
        numbers.add(number);
        break;
      }
    }
  }
  
  return Array.from(numbers);
}

/**
 * Simple string hash function for seeding
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate score frequencies from a set of golf scores
 * Input: Array of arrays, where each inner array contains a user's golf scores
 * Output: Array of ScoreFrequency objects
 */
export function calculateScoreFrequencies(allScores: number[][]): ScoreFrequency[] {
  const frequencyMap = new Map<number, number>();
  
  // Count frequency of each score across all users
  for (const scores of allScores) {
    for (const score of scores) {
      frequencyMap.set(score, (frequencyMap.get(score) || 0) + 1);
    }
  }
  
  // Convert to array and sort by score
  const frequencies: ScoreFrequency[] = [];
  for (let score = 1; score <= 45; score++) {
    const frequency = frequencyMap.get(score) || 0;
    frequencies.push({
      score,
      frequency,
      weight: frequency + 1, // +1 ensures non-zero weight
    });
  }
  
  return frequencies;
}
