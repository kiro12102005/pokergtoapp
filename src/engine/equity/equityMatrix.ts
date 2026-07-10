import { ALL_HANDS, comboCount } from "@/domain/cards/handNotation";
import { RandomSource, seededRandom } from "@/domain/cards/deck";
import { canonicalHandVsHandEquity, EquityOptions } from "./equityCalculator";

export type EquityMatrix = Record<string, Record<string, number>>;

/**
 * Builds the full 169x169 canonical-hand-vs-canonical-hand equity matrix via Monte Carlo
 * (see equityCalculator.ts). This is the expensive, offline-only step - run once via
 * scripts/precompute-preflop.ts and cache the result to disk; never call at request time.
 */
export function buildEquityMatrix(
  options: EquityOptions = {},
  onProgress?: (done: number, total: number) => void
): EquityMatrix {
  const matrix: EquityMatrix = {};
  for (const hand of ALL_HANDS) matrix[hand] = {};

  const totalPairs = (ALL_HANDS.length * (ALL_HANDS.length + 1)) / 2;
  let done = 0;

  for (let i = 0; i < ALL_HANDS.length; i++) {
    const handA = ALL_HANDS[i];
    for (let j = i; j < ALL_HANDS.length; j++) {
      const handB = ALL_HANDS[j];
      const equity =
        handA === handB ? 0.5 : canonicalHandVsHandEquity(handA, handB, options);
      matrix[handA][handB] = equity;
      matrix[handB][handA] = 1 - equity;
      done++;
      if (onProgress && done % 500 === 0) onProgress(done, totalPairs);
    }
  }
  if (onProgress) onProgress(totalPairs, totalPairs);
  return matrix;
}

export function defaultEquityRandom(seed = 42): RandomSource {
  return seededRandom(seed);
}

/**
 * Equity of `hand` against a weighted range (canonical hand -> weight in [0,1], typically a
 * combo-count-adjusted probability mass), using the precomputed matrix for O(range size) lookup.
 */
export function equityVsRangeFromMatrix(
  hand: string,
  range: Map<string, number>,
  matrix: EquityMatrix
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [oppHand, weight] of range.entries()) {
    if (weight <= 0) continue;
    const comboWeight = weight * comboCount(oppHand);
    const equity = oppHand === hand ? 0.5 : matrix[hand][oppHand];
    weightedSum += equity * comboWeight;
    totalWeight += comboWeight;
  }
  if (totalWeight === 0) return 0.5;
  return weightedSum / totalWeight;
}
