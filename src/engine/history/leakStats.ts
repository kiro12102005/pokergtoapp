import { ActionType, Street } from "@/domain/scenario/scenarioState";
import { Position } from "@/domain/table/seats";
import { AnalyzeResultDisplay } from "@/engine/advisor/types";
import { HandRecord } from "./handRecord";

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river"];
const ALL_POSITIONS: Position[] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];

/** Below this many samples, a match rate is more noise than signal - the category is omitted
 *  from the summary entirely rather than showing a misleading 0%/100% from 1-2 hands. */
const MIN_SAMPLES = 3;

export interface MatchRateStat {
  total: number;
  matches: number;
}

export interface StreetMatchRateStat extends MatchRateStat {
  street: Street;
}

export interface PositionMatchRateStat extends MatchRateStat {
  position: Position;
}

export interface LeakStats {
  totalDecisions: number;
  totalMatches: number;
  /** Ascending by match rate (weakest first), only streets with >= MIN_SAMPLES decisions. */
  byStreet: StreetMatchRateStat[];
  /** Ascending by match rate (weakest first), only positions with >= MIN_SAMPLES decisions. */
  byPosition: PositionMatchRateStat[];
}

/** The single highest-frequency action in a result's recommendation - what "matching the
 *  recommendation" is measured against. Ties resolve to whichever action iterates first, which
 *  is an acceptable simplification since a true tie is rare with real solver/LLM output.
 *  Exported for filterRecords.ts, which measures the same "did the actual choice match" concept
 *  per-record rather than aggregated. */
export function recommendedAction(frequencies: AnalyzeResultDisplay["frequencies"]): ActionType | null {
  if (!frequencies) return null;
  let best: ActionType | null = null;
  let bestValue = -Infinity;
  for (const [action, value] of Object.entries(frequencies) as [ActionType, number | undefined][]) {
    if ((value ?? 0) > bestValue) {
      bestValue = value ?? 0;
      best = action;
    }
  }
  return best;
}

function bump(map: Map<string, MatchRateStat>, key: string, matched: boolean): void {
  const entry = map.get(key) ?? { total: 0, matches: 0 };
  entry.total += 1;
  if (matched) entry.matches += 1;
  map.set(key, entry);
}

/**
 * Aggregates already-saved hand history (see historyStore.ts's fetchStatsRecords) into "how
 * often did hero's actual choice match the recommendation" by street and by position - a
 * leak-finder view of data this app already computes per saved hand (AnalyzeResultDisplay's
 * `actualAction` + `frequencies`), no new tracking required. Only decisions where hero's actual
 * choice is known and a recommendation exists are counted - "what should I do right now" previews
 * (no actualAction) and failed LLM calls (source: "error", no frequencies) are skipped.
 */
export function computeLeakStats(records: HandRecord[]): LeakStats {
  const byStreetMap = new Map<string, MatchRateStat>();
  const byPositionMap = new Map<string, MatchRateStat>();
  let totalDecisions = 0;
  let totalMatches = 0;

  for (const record of records) {
    for (const result of record.results) {
      if (!result.actualAction) continue;
      const recommended = recommendedAction(result.frequencies);
      if (!recommended) continue;

      const matched = recommended === result.actualAction.action;
      totalDecisions += 1;
      if (matched) totalMatches += 1;

      bump(byStreetMap, result.street, matched);
      bump(byPositionMap, result.actualAction.position, matched);
    }
  }

  const byStreet = STREET_ORDER.filter((s) => (byStreetMap.get(s)?.total ?? 0) >= MIN_SAMPLES)
    .map((street) => ({ street, ...byStreetMap.get(street)! }))
    .sort((a, b) => a.matches / a.total - b.matches / b.total);

  const byPosition = ALL_POSITIONS.filter((p) => (byPositionMap.get(p)?.total ?? 0) >= MIN_SAMPLES)
    .map((position) => ({ position, ...byPositionMap.get(position)! }))
    .sort((a, b) => a.matches / a.total - b.matches / b.total);

  return { totalDecisions, totalMatches, byStreet, byPosition };
}
