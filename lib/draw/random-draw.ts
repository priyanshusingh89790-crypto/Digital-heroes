import crypto from 'crypto';
import type { DrawConfig, DrawResult, DrawNumberRange } from './types';

const ALGORITHM_VERSION = 'random-v1';

/**
 * Generate a cryptographically secure random draw
 * Uses Node.js crypto module for server-side secure random generation
 */
export function generateRandomDraw(config: DrawConfig): DrawResult {
  const { numberRange, count } = config;
  const numbers = generateUniqueRandomNumbers(numberRange, count);
  
  return {
    numbers: numbers.sort((a, b) => a - b), // Always return sorted
    type: 'random',
    metadata: {
      algorithmVersion: ALGORITHM_VERSION,
      timestamp: new Date().toISOString(),
      numberRange,
      count,
      method: 'crypto-random-bytes',
    },
  };
}

/**
 * Generate unique random numbers within a range using crypto
 * Ensures no duplicates and cryptographically secure randomness
 */
function generateUniqueRandomNumbers(range: DrawNumberRange, count: number): number[] {
  const numbers = new Set<number>();
  const rangeSize = range.max - range.min + 1;
  
  if (count > rangeSize) {
    throw new Error(`Cannot generate ${count} unique numbers from range of size ${rangeSize}`);
  }
  
  // Use crypto.randomBytes for secure random number generation
  while (numbers.size < count) {
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0) / 0xFFFFFFFF; // Normalize to 0-1
    const scaledValue = Math.floor(randomValue * rangeSize) + range.min;
    numbers.add(scaledValue);
  }
  
  return Array.from(numbers);
}

/**
 * Generate a deterministic random draw for simulation/testing
 * Uses a seed for reproducibility (NOT for production draws)
 */
export function generateSeededRandomDraw(config: DrawConfig, seed: string): DrawResult {
  const { numberRange, count } = config;
  const numbers = generateSeededUniqueNumbers(numberRange, count, seed);
  
  return {
    numbers: numbers.sort((a, b) => a - b),
    type: 'random',
    metadata: {
      algorithmVersion: ALGORITHM_VERSION,
      timestamp: new Date().toISOString(),
      numberRange,
      count,
      method: 'seeded-random',
      seed,
      warning: 'Seeded random - for simulation only',
    },
  };
}

/**
 * Simple seeded random number generator for simulation
 * Uses a basic hash function to convert seed to numbers
 * NOT cryptographically secure - for testing/simulation only
 */
function generateSeededUniqueNumbers(range: DrawNumberRange, count: number, seed: string): number[] {
  const numbers = new Set<number>();
  const rangeSize = range.max - range.min + 1;
  
  if (count > rangeSize) {
    throw new Error(`Cannot generate ${count} unique numbers from range of size ${rangeSize}`);
  }
  
  let hash = simpleHash(seed);
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  
  while (numbers.size < count) {
    hash = (a * hash + c) % m;
    const randomValue = hash / m;
    const scaledValue = Math.floor(randomValue * rangeSize) + range.min;
    numbers.add(scaledValue);
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
