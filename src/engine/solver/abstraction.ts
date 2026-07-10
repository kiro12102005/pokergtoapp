import { Position } from "@/domain/table/seats";

/** Effective-stack-in-BB buckets the solver solves independently. */
export const STACK_DEPTH_BUCKETS_BB: number[] = [100, 60, 40, 25, 15, 10, 7, 5, 3];

/** Below this effective stack depth, the action space collapses to shove-or-fold only. */
export const SHOVE_ONLY_THRESHOLD_BB = 20;

export function nearestStackBucket(effectiveStackBB: number): number {
  let best = STACK_DEPTH_BUCKETS_BB[0];
  let bestDiff = Math.abs(effectiveStackBB - best);
  for (const bucket of STACK_DEPTH_BUCKETS_BB) {
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

/** Placeholder ante-to-BB ratio used until real club-match blind data narrows this down. */
export const ANTE_TO_BB_RATIO = 0.125;

export function situationKey(
  position: Position,
  stackBucket: number,
  actionHistory: ActionHistoryKey
): string {
  return `${position}|${stackBucket}|${actionHistory}`;
}
