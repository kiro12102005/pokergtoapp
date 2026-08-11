import { HandRecord } from "./handRecord";
import { MatchRateStat, recommendedAction } from "./leakStats";

/** Same noise floor as leakStats.ts's byStreet/byPosition breakdowns - a week with fewer
 *  decisions than this is more noise than signal and is omitted from the trend entirely. */
const MIN_SAMPLES_PER_WEEK = 3;
/** Caps how many of the most recent weeks are returned, so a long history doesn't produce an
 *  unreadably wide/cramped chart - see TrendLineChart.tsx. */
const MAX_WEEKS = 12;

export interface WeeklyMatchRate extends MatchRateStat {
  /** ISO date (YYYY-MM-DD) of the Monday starting this week - both the bucket key and the
   *  x-axis label source (see TrendLineChart.tsx's formatWeekLabel). */
  weekStart: string;
}

/** The Monday (UTC) of the week containing `dateIso` - UTC-based (not local time) so bucketing
 *  is stable regardless of which timezone this runs in (server-rendered vs. a user's browser). */
function isoWeekStart(dateIso: string): string {
  const d = new Date(dateIso);
  const utcDay = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (utcDay + 6) % 7; // Mon->0, Tue->1, ..., Sun->6
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday));
  return monday.toISOString().slice(0, 10);
}

/**
 * Buckets the same "did hero's actual choice match the recommendation" decisions
 * computeLeakStats() aggregates into a single current snapshot, but by the week each record was
 * created in - so /history/stats can show a trend line of the overall match rate over time (see
 * TrendLineChart.tsx) rather than just where things stand right now. Only weeks with enough
 * samples are included, and only the most recent MAX_WEEKS - both to keep the chart readable and
 * to avoid a misleadingly precise-looking 0%/100% from a couple of hands.
 */
export function computeWeeklyMatchRate(records: HandRecord[]): WeeklyMatchRate[] {
  const byWeek = new Map<string, MatchRateStat>();

  for (const record of records) {
    const week = isoWeekStart(record.createdAt);
    for (const result of record.results) {
      if (!result.actualAction) continue;
      const recommended = recommendedAction(result.frequencies);
      if (!recommended) continue;

      const matched = recommended === result.actualAction.action;
      const entry = byWeek.get(week) ?? { total: 0, matches: 0 };
      entry.total += 1;
      if (matched) entry.matches += 1;
      byWeek.set(week, entry);
    }
  }

  const weeks = [...byWeek.entries()]
    .filter(([, stat]) => stat.total >= MIN_SAMPLES_PER_WEEK)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([weekStart, stat]) => ({ weekStart, ...stat }));

  return weeks.slice(-MAX_WEEKS);
}
