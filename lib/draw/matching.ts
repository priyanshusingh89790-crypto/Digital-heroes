import type { MatchResult, MatchTier } from './types';

/**
 * Match draw numbers against entry numbers
 * 
 * MATCHING ALGORITHM (Implementation Decision):
 * - Exact set matching: count how many of the draw numbers appear in the entry numbers
 * - Numbers are compared as sets (order doesn't matter)
 * - User is classified into the highest tier they qualify for
 * - A user cannot win multiple tiers for the same draw
 * - Tiers: 5-match (all 5), 4-match (exactly 4), 3-match (exactly 3)
 * 
 * This is a standard lottery-style matching mechanism that is:
 * - Easy to understand
 * - Fair and transparent
 * - Deterministic and auditable
 */
export function calculateMatch(
  drawNumbers: number[],
  entryNumbers: number[],
  entryId: string,
  userId: string
): MatchResult {
  // Validate inputs
  if (drawNumbers.length !== 5) {
    throw new Error('Draw numbers must contain exactly 5 numbers');
  }
  if (entryNumbers.length !== 5) {
    throw new Error('Entry numbers must contain exactly 5 numbers');
  }

  // Calculate matches using set intersection
  const drawSet = new Set(drawNumbers);
  const entrySet = new Set(entryNumbers);
  
  const matchedNumbers: number[] = [];
  for (const num of entrySet) {
    if (drawSet.has(num)) {
      matchedNumbers.push(num);
    }
  }

  const matchedCount = matchedNumbers.length;

  // Determine tier based on match count
  // Only assign tier if user qualifies for that exact match count
  let tier: MatchTier | null = null;
  if (matchedCount === 5) {
    tier = 5;
  } else if (matchedCount === 4) {
    tier = 4;
  } else if (matchedCount === 3) {
    tier = 3;
  }

  return {
    entryId,
    userId,
    matchedCount,
    matchedNumbers: matchedNumbers.sort((a, b) => a - b),
    tier,
  };
}

/**
 * Calculate matches for multiple entries
 */
export function calculateMatches(
  drawNumbers: number[],
  entries: Array<{ id: string; userId: string; selectedNumbers: number[] }>
): MatchResult[] {
  return entries.map(entry =>
    calculateMatch(drawNumbers, entry.selectedNumbers, entry.id, entry.userId)
  );
}

/**
 * Group matches by tier for prize distribution
 */
export function groupMatchesByTier(matches: MatchResult[]): Map<MatchTier, MatchResult[]> {
  const groups = new Map<MatchTier, MatchResult[]>();
  
  for (const match of matches) {
    if (match.tier) {
      const existing = groups.get(match.tier) || [];
      existing.push(match);
      groups.set(match.tier, existing);
    }
  }
  
  return groups;
}

/**
 * Validate that draw numbers are valid (5 unique numbers within range)
 */
export function validateDrawNumbers(numbers: number[], min: number = 1, max: number = 45): boolean {
  if (numbers.length !== 5) return false;
  
  const uniqueNumbers = new Set(numbers);
  if (uniqueNumbers.size !== 5) return false;
  
  for (const num of numbers) {
    if (num < min || num > max) return false;
  }
  
  return true;
}
