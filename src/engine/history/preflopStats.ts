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

export interface PracticeStreak {
  /** How many attempts were logged on `now`'s local calendar day. */
  todayCount: number;
  /** Consecutive local calendar days (ending today, or ending yesterday if today has no attempts
   *  yet - see below) with at least one logged attempt. */
  currentStreakDays: number;
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Computes "how many questions answered today" and "how many days in a row" from logged preflop
 * attempts, for the /train streak badge and /history/stats summary. Grouped by the *local*
 * calendar day (via Date's local getters, not UTC) so "today"/"yesterday" match what the user
 * sees on their own device clock, not the server's.
 *
 * A day with zero attempts breaks the streak - except `now`'s own day, which doesn't zero out an
 * otherwise-intact streak just because the user hasn't practiced *yet* today (they still can).
 * `now` is injectable (defaults to the real clock) so this stays a pure, unit-testable function -
 * the same pattern RandomSource injection uses elsewhere in this codebase.
 */
export function computePracticeStreak(attempts: PreflopAttemptRecord[], now: Date = new Date()): PracticeStreak {
  const nowKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const attemptDays = new Set(attempts.map((a) => localDayKey(a.createdAt)));
  const todayCount = attempts.filter((a) => localDayKey(a.createdAt) === nowKey).length;

  const cursor = new Date(now);
  if (todayCount === 0) cursor.setDate(cursor.getDate() - 1);

  let currentStreakDays = 0;
  while (attemptDays.has(`${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`)) {
    currentStreakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { todayCount, currentStreakDays };
}
