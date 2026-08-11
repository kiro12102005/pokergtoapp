import { CashRakePercent, GameFormat } from "@/domain/table/gameFormat";
import { Position } from "@/domain/table/seats";
import { StrategyMix } from "@/domain/scenario/scenarioState";
import { ActionHistoryKey, nearestStackBucket, situationKey, stackDepthBucketsFor } from "./abstraction";
import solverOutput from "@/data/solverOutput/preflop.json";

type SolverOutputFile = {
  situations: Record<string, Record<string, StrategyMix>>;
};

const data = solverOutput as SolverOutputFile;

export class SolverLookupError extends Error {}

/**
 * O(1) runtime lookup into the offline-precomputed preflop strategy tables (see
 * scripts/precompute-preflop.ts, which solves both `format`s - and, for cash, all three rake
 * tiers - into the same file). Never runs solver computation in the browser.
 *
 * `rakePercent` only matters for `format: "cash"` (tournament is always solved/looked up at 0,
 * see domain/table/gameFormat.ts's CashRakePercent doc) - defaults to 0 so tournament call
 * sites don't need to pass it.
 */
export function lookupPreflopStrategy(
  position: Position,
  effectiveStackBB: number,
  actionHistory: ActionHistoryKey,
  hand: string,
  format: GameFormat,
  rakePercent: CashRakePercent = 0
): StrategyMix {
  const bucket = nearestStackBucket(effectiveStackBB, stackDepthBucketsFor(format));
  const key = situationKey(position, bucket, actionHistory, format, format === "cash" ? rakePercent : 0);
  const situation = data.situations[key];
  if (!situation) {
    throw new SolverLookupError(`No precomputed situation for key: ${key}`);
  }
  const mix = situation[hand];
  if (!mix) {
    throw new SolverLookupError(`No precomputed strategy for hand ${hand} in situation ${key}`);
  }
  return mix;
}

export function hasPreflopSituation(
  position: Position,
  effectiveStackBB: number,
  actionHistory: ActionHistoryKey,
  format: GameFormat,
  rakePercent: CashRakePercent = 0
): boolean {
  const bucket = nearestStackBucket(effectiveStackBB, stackDepthBucketsFor(format));
  const key = situationKey(position, bucket, actionHistory, format, format === "cash" ? rakePercent : 0);
  return Boolean(data.situations[key]);
}
