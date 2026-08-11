import { Street } from "@/domain/scenario/scenarioState";
import { Position } from "@/domain/table/seats";
import { HandRecord } from "./handRecord";
import { recommendedAction } from "./leakStats";

export interface HistoryFilter {
  position: Position | "all";
  street: Street | "all";
  /** Whether hero's actual choice matched the recommendation (highest-frequency action) - same
   *  "did it match" concept leakStats.ts aggregates, applied here per-record for search/filter
   *  rather than as an overall statistic. */
  match: "all" | "matched" | "mismatched";
}

export const DEFAULT_HISTORY_FILTER: HistoryFilter = { position: "all", street: "all", match: "all" };

export function hasActiveFilter(filter: HistoryFilter): boolean {
  return filter.position !== "all" || filter.street !== "all" || filter.match !== "all";
}

/**
 * Whether at least one decision within `record` satisfies every active dimension of `filter` -
 * see /history/page.tsx's filter UI. A saved hand can carry multiple decision points (e.g. hero
 * acted on both flop and turn), and HandRecordCard always shows the whole record with all of
 * them, so a record qualifies if ANY of its decisions matches every active filter dimension
 * (rather than requiring one single decision to satisfy all three at once, which would hide
 * records where e.g. the BTN decision was on the flop and the mismatch happened on the turn).
 */
export function recordMatchesFilter(record: HandRecord, filter: HistoryFilter): boolean {
  if (!hasActiveFilter(filter)) return true;

  return record.results.some((result) => {
    if (filter.position !== "all" && result.actualAction?.position !== filter.position) return false;
    if (filter.street !== "all" && result.street !== filter.street) return false;
    if (filter.match !== "all") {
      if (!result.actualAction || !result.frequencies) return false;
      const matched = recommendedAction(result.frequencies) === result.actualAction.action;
      if (filter.match === "matched" && !matched) return false;
      if (filter.match === "mismatched" && matched) return false;
    }
    return true;
  });
}
