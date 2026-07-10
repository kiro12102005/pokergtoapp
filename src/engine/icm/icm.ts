/**
 * ICM (Independent Chip Model) via the standard Malmuth-Harville recursive method:
 * P(player i finishes 1st) = stack_i / totalChips; P(finishes 2nd) is the same formula
 * applied recursively to the remaining players after removing whoever finished 1st, etc.
 *
 * This implementation is payout-vector-agnostic: it works identically whether `payouts`
 * is a dollar prize vector or (as used throughout this app) a finish-position points
 * vector, since the math only ever takes a dot product against place probabilities.
 */

/**
 * Solver inner loops call this with the same handful of "reference" stack distributions
 * (e.g. "hero wins the all-in", "everyone folds") an enormous number of times (once per hand
 * pair, per node, per iteration), so caching matters a lot for performance - but callers also
 * generate many one-off distributions (one per equity fraction), so the cache must not grow
 * without bound. Solution: cache within a single solve, and have the caller (see
 * scripts/precompute-preflop.ts) call clearIcmCache() between solves to bound memory.
 */
const finishProbabilityCache = new Map<string, number[][]>();

export function clearIcmCache(): void {
  finishProbabilityCache.clear();
}

/**
 * Returns an n x n matrix `probs[playerIndex][place]` = probability that player
 * `playerIndex` (matching the input `stacks` order) finishes in `place` (0 = 1st).
 */
export function finishProbabilities(stacks: number[]): number[][] {
  const n = stacks.length;
  if (n === 0) return [];
  if (n === 1) return [[1]];

  const cacheKey = stacks.join(",");
  const cached = finishProbabilityCache.get(cacheKey);
  if (cached) return cached;

  const total = stacks.reduce((a, b) => a + b, 0);
  const result: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    if (stacks[i] <= 0) continue;
    const pFirst = stacks[i] / total;
    result[i][0] += pFirst;

    const remainingIdx = [...Array(n).keys()].filter((k) => k !== i);
    const remainingStacks = remainingIdx.map((k) => stacks[k]);
    const subProbs = finishProbabilities(remainingStacks);

    for (let sub = 0; sub < remainingIdx.length; sub++) {
      const j = remainingIdx[sub];
      for (let place = 0; place < n - 1; place++) {
        result[j][place + 1] += pFirst * subProbs[sub][place];
      }
    }
  }

  finishProbabilityCache.set(cacheKey, result);
  return result;
}

/**
 * Expected value per player against a finish-position payout vector (index 0 = 1st place
 * payout, ..., index n-1 = last place payout). Works for the club-match points vector
 * (which includes a negative value for last place) just as well as a standard prize pool.
 */
export function icmEquity(stacks: number[], payouts: number[]): number[] {
  if (stacks.length !== payouts.length) {
    throw new Error("stacks and payouts must be the same length");
  }
  const probs = finishProbabilities(stacks);
  return probs.map((placeProbs) =>
    placeProbs.reduce((sum, p, place) => sum + p * payouts[place], 0)
  );
}
