import { CashRakePercent, GameFormat } from "@/domain/table/gameFormat";
import { Position } from "@/domain/table/seats";

/** Effective-stack-in-BB buckets the solver solves independently (tournament format). */
export const STACK_DEPTH_BUCKETS_BB: number[] = [100, 60, 40, 25, 15, 10, 7, 5, 3];

/** Cash tables commonly play deeper than a tournament ever reaches (150BB/200BB), so the cash
 *  bucket set extends the tournament one upward rather than replacing it - see
 *  scripts/precompute-preflop.ts, which solves this bucket set with a pure chip-EV objective
 *  (no ICM) and no ante instead of the tournament's ICM/ante-adjusted solve. */
export const CASH_STACK_DEPTH_BUCKETS_BB: number[] = [200, 150, 100, 60, 40, 25, 15, 10, 7, 5, 3];

export function stackDepthBucketsFor(format: GameFormat): number[] {
  return format === "cash" ? CASH_STACK_DEPTH_BUCKETS_BB : STACK_DEPTH_BUCKETS_BB;
}

/** Below this effective stack depth, the action space collapses to shove-or-fold only. */
export const SHOVE_ONLY_THRESHOLD_BB = 20;

/** Nearest value in `buckets` to `effectiveStackBB` - defaults to the tournament bucket set so
 *  callers with no format concept of their own (e.g. handStrength.ts's default-range-width
 *  heuristic, which is keyed by these specific reference depths) don't need to think about
 *  GameFormat at all. Solver lookups pass `stackDepthBucketsFor(format)` explicitly - see
 *  solverLookup.ts. */
export function nearestStackBucket(effectiveStackBB: number, buckets: number[] = STACK_DEPTH_BUCKETS_BB): number {
  let best = buckets[0];
  let bestDiff = Math.abs(effectiveStackBB - best);
  for (const bucket of buckets) {
    const diff = Math.abs(effectiveStackBB - bucket);
    if (diff < bestDiff) {
      best = bucket;
      bestDiff = diff;
    }
  }
  return best;
}

export function isShoveOnlyDepth(stackBB: number): boolean {
  return stackBB <= SHOVE_ONLY_THRESHOLD_BB;
}

/** Action-history layers the solver covers for each position (fewer apply to earlier seats). */
export type ActionHistoryKey = "rfi" | "vsOpen" | "vs3bet" | "vs4bet";

export const ACTION_HISTORY_LAYERS: ActionHistoryKey[] = ["rfi", "vsOpen", "vs3bet", "vs4bet"];

/** Fixed open-raise / 3-bet / 4-bet sizing set (in BB of the raise-to amount), non-shove depths. */
export const OPEN_RAISE_SIZE_BB = 2.5;
export const THREE_BET_SIZE_MULTIPLIER_IP = 3;
export const THREE_BET_SIZE_MULTIPLIER_OOP = 4;
export const FOUR_BET_SIZE_MULTIPLIER = 2.2;

/** Placeholder ante-to-BB ratio used until real club-match blind data narrows this down
 *  (tournament format only). */
export const ANTE_TO_BB_RATIO = 0.125;

/** Standard cash/ring games don't ante - see scripts/precompute-preflop.ts and
 *  domain/scenario/*ScenarioGenerator.ts's format-conditional dead-money calculations. */
export const CASH_ANTE_TO_BB_RATIO = 0;

export function anteToBBRatioFor(format: GameFormat): number {
  return format === "cash" ? CASH_ANTE_TO_BB_RATIO : ANTE_TO_BB_RATIO;
}

/** `rakePercent` is only meaningful for cash (tournament always solves/looks up at 0 - see
 *  domain/table/gameFormat.ts's CashRakePercent doc) but is always part of the key so a
 *  tournament and a cash-at-0%-rake situation never collide. */
export function situationKey(
  position: Position,
  stackBucket: number,
  actionHistory: ActionHistoryKey,
  format: GameFormat,
  rakePercent: CashRakePercent
): string {
  return `${position}|${stackBucket}|${actionHistory}|${format}|${rakePercent}`;
}
