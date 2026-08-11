import { CashRakePercent, GameFormat } from "@/domain/table/gameFormat";
import { Position } from "@/domain/table/seats";
import { StrategyMix } from "@/domain/scenario/scenarioState";
import { ActionHistoryKey, nearestStackBucket, situationKey, stackDepthBucketsFor } from "./abstraction";

type SolverOutputFile = {
  situations: Record<string, Record<string, StrategyMix>>;
};

export class SolverLookupError extends Error {}

// A static `import ... from "@/data/solverOutput/preflop.json"` gets inlined directly into
// whichever route bundle imports it (transitively, via scenarioStore.ts/analyzeStore.ts) - since
// the file is several MB, that means every route pulling this in ships its own multi-MB copy in
// its JS chunk, and each one has to be downloaded and parsed separately even though the data is
// identical everywhere. A dynamic import() instead becomes its own content-hashed chunk, fetched
// and cached by the browser exactly once regardless of how many routes end up needing it - see
// the "①" bundling fix in this session's history. Cached in this module-level promise so repeat
// calls within the same page load don't even re-trigger the module resolution machinery.
let dataPromise: Promise<SolverOutputFile> | null = null;

function loadSolverData(): Promise<SolverOutputFile> {
  if (!dataPromise) {
    dataPromise = import("@/data/solverOutput/preflop.json").then(
      (mod) => (mod.default ?? mod) as unknown as SolverOutputFile
    );
  }
  return dataPromise;
}

/**
 * O(1) runtime lookup into the offline-precomputed preflop strategy tables (see
 * scripts/precompute-preflop.ts, which solves both `format`s - and, for cash, all three rake
 * tiers - into the same file). Never runs solver computation in the browser. Async because the
 * underlying data file is now lazy-loaded (see loadSolverData) rather than bundled eagerly.
 *
 * `rakePercent` only matters for `format: "cash"` (tournament is always solved/looked up at 0,
 * see domain/table/gameFormat.ts's CashRakePercent doc) - defaults to 0 so tournament call
 * sites don't need to pass it.
 */
export async function lookupPreflopStrategy(
  position: Position,
  effectiveStackBB: number,
  actionHistory: ActionHistoryKey,
  hand: string,
  format: GameFormat,
  rakePercent: CashRakePercent = 0
): Promise<StrategyMix> {
  const data = await loadSolverData();
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

export async function hasPreflopSituation(
  position: Position,
  effectiveStackBB: number,
  actionHistory: ActionHistoryKey,
  format: GameFormat,
  rakePercent: CashRakePercent = 0
): Promise<boolean> {
  const data = await loadSolverData();
  const bucket = nearestStackBucket(effectiveStackBB, stackDepthBucketsFor(format));
  const key = situationKey(position, bucket, actionHistory, format, format === "cash" ? rakePercent : 0);
  return Boolean(data.situations[key]);
}

/**
 * Returns the full precomputed strategy table for a situation - all 169 hands' frequency mixes,
 * not just one - for the range-grid heatmap (see components/feedback/RangeGrid.tsx). Same
 * situation-key resolution as lookupPreflopStrategy/hasPreflopSituation, just without picking out
 * a single hand at the end.
 */
export async function lookupPreflopRange(
  position: Position,
  effectiveStackBB: number,
  actionHistory: ActionHistoryKey,
  format: GameFormat,
  rakePercent: CashRakePercent = 0
): Promise<Record<string, StrategyMix>> {
  const data = await loadSolverData();
  const bucket = nearestStackBucket(effectiveStackBB, stackDepthBucketsFor(format));
  const key = situationKey(position, bucket, actionHistory, format, format === "cash" ? rakePercent : 0);
  const situation = data.situations[key];
  if (!situation) {
    throw new SolverLookupError(`No precomputed situation for key: ${key}`);
  }
  return situation;
}
