import { Position } from "@/domain/table/seats";

const ALL_POSITIONS: Position[] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];

/** One logged preflop-trainer attempt, as read back from Supabase - see
 *  preflopStatsStore.ts's fetchAttempts(). Deliberately not the full row (no stack/hand/etc.),
 *  since this module's summary only ever groups by position and time. */
export interface PreflopAttemptRecord {
  createdAt: string;
  position: Position;
  isCorrect: boolean;
}

/** How many of the most recent attempts count as "recent" for the recent-vs-all-time comparison
 *  - enough to smooth out single-hand luck, small enough to reflect current form. */
const RECENT_WINDOW = 20;

/** Below this many attempts, a position's accuracy is more noise than signal - see leakStats.ts
 *  for the same reasoning applied to hand-history streets/positions. */
const MIN_SAMPLES = 3;

export interface PositionAccuracy {
  position: Position;
  total: number;
  correct: number;
}

export interface PreflopStatsSummary {
  totalAttempts: number;
  totalCorrect: number;
  /** Out of the most recent RECENT_WINDOW attempts (or fewer, if there aren't that many yet). */
  recentAttempts: number;
  recentCorrect: number;
  /** Ascending by accuracy (weakest first), only positions with >= MIN_SAMPLES attempts. */
  byPosition: PositionAccuracy[];
}

/**
 * Summarizes the preflop trainer's logged attempts (see preflopStatsStore.ts's fetchAttempts) for
 * the /history/stats dashboard - overall and recent accuracy, plus a by-position breakdown to
 * surface weak spots. Assumes `attempts` is already sorted newest-first (as fetchAttempts()
 * returns it) - the recent-window slice depends on that order, not on re-sorting by createdAt.
 */
export function summarizePreflopAttempts(attempts: PreflopAttemptRecord[]): PreflopStatsSummary {
  const totalAttempts = attempts.length;
  const totalCorrect = attempts.filter((a) => a.isCorrect).length;

  const recent = attempts.slice(0, RECENT_WINDOW);
  const recentAttempts = recent.length;
  const recentCorrect = recent.filter((a) => a.isCorrect).length;

  const byPositionMap = new Map<Position, { total: number; correct: number }>();
  for (const attempt of attempts) {
    const entry = byPositionMap.get(attempt.position) ?? { total: 0, correct: 0 };
    entry.total += 1;
    if (attempt.isCorrect) entry.correct += 1;
    byPositionMap.set(attempt.position, entry);
  }

  const byPosition = ALL_POSITIONS.filter((p) => (byPositionMap.get(p)?.total ?? 0) >= MIN_SAMPLES)
    .map((position) => ({ position, ...byPositionMap.get(position)! }))
    .sort((a, b) => a.correct / a.total - b.correct / b.total);

  return { totalAttempts, totalCorrect, recentAttempts, recentCorrect, byPosition };
}
