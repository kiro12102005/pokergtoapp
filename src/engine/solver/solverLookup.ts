import { Position } from "@/domain/table/seats";
import { StrategyMix } from "@/domain/scenario/scenarioState";
import { ActionHistoryKey, nearestStackBucket, situationKey } from "./abstraction";
import solverOutput from "@/data/solverOutput/preflop.json";

type SolverOutputFile = {
  situations: Record<string, Record<string, StrategyMix>>;
};

const data = solverOutput as SolverOutputFile;

export class SolverLookupError extends Error {}

/**
 * O(1) runtime lookup into the offline-precomputed preflop strategy tables (see
 * scripts/precompute-preflop.ts). Never runs solver computation in the browser.
 */
export function lookupPreflopStrategy(
  position: Position,
  effectiveStackBB: number,
  actionHistory: ActionHistoryKey,
  hand: string
): StrategyMix {
  const bucket = nearestStackBucket(effectiveStackBB);
  const key = situationKey(position, bucket, actionHistory);
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
  actionHistory: ActionHistoryKey
): boolean {
  const bucket = nearestStackBucket(effectiveStackBB);
  const key = situationKey(position, bucket, actionHistory);
  return Boolean(data.situations[key]);
}
