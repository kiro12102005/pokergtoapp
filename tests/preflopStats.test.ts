import { describe, it, expect } from "vitest";
import { computePracticeStreak, summarizePreflopAttempts, PreflopAttemptRecord } from "@/engine/history/preflopStats";

function attempt(position: PreflopAttemptRecord["position"], isCorrect: boolean, createdAt = "2026-08-11T00:00:00Z"): PreflopAttemptRecord {
  return { createdAt, position, isCorrect };
}

describe("summarizePreflopAttempts", () => {
  it("computes overall totals", () => {
    const summary = summarizePreflopAttempts([attempt("BTN", true), attempt("BTN", false), attempt("BB", true)]);
    expect(summary.totalAttempts).toBe(3);
    expect(summary.totalCorrect).toBe(2);
  });

  it("computes the recent-window accuracy from only the newest N (assumes newest-first input)", () => {
    // 25 attempts newest-first: the first 20 (recent window) are all correct, the oldest 5 are all wrong.
    const attempts = [
      ...Array.from({ length: 20 }, () => attempt("BTN", true)),
      ...Array.from({ length: 5 }, () => attempt("BTN", false)),
    ];
    const summary = summarizePreflopAttempts(attempts);
    expect(summary.totalAttempts).toBe(25);
    expect(summary.totalCorrect).toBe(20);
    expect(summary.recentAttempts).toBe(20);
    expect(summary.recentCorrect).toBe(20);
  });

  it("caps recentAttempts at the total when fewer than the window exist", () => {
    const summary = summarizePreflopAttempts([attempt("BTN", true), attempt("BTN", false)]);
    expect(summary.recentAttempts).toBe(2);
    expect(summary.recentCorrect).toBe(1);
  });

  it("breaks down by position, ascending by accuracy, above the sample-size floor", () => {
    const attempts = [
      // BTN: 1/4 correct (weak)
      attempt("BTN", true),
      attempt("BTN", false),
      attempt("BTN", false),
      attempt("BTN", false),
      // BB: 3/3 correct (strong)
      attempt("BB", true),
      attempt("BB", true),
      attempt("BB", true),
    ];
    const summary = summarizePreflopAttempts(attempts);
    expect(summary.byPosition.map((p) => p.position)).toEqual(["BTN", "BB"]);
    expect(summary.byPosition[0]).toEqual({ position: "BTN", total: 4, correct: 1 });
    expect(summary.byPosition[1]).toEqual({ position: "BB", total: 3, correct: 3 });
  });

  it("omits a position with fewer than the minimum sample size", () => {
    const summary = summarizePreflopAttempts([attempt("SB", true), attempt("SB", false)]);
    expect(summary.byPosition).toEqual([]);
  });

  it("handles an empty history without throwing", () => {
    const summary = summarizePreflopAttempts([]);
    expect(summary).toEqual({ totalAttempts: 0, totalCorrect: 0, recentAttempts: 0, recentCorrect: 0, byPosition: [] });
  });
});

describe("computePracticeStreak", () => {
  // Local noon avoids any midnight/timezone-boundary flakiness in these fixed-date tests.
  const NOW = new Date(2026, 7, 11, 12, 0, 0); // 2026-08-11 (August is month index 7)

  it("counts today's attempts and a same-day streak of 1", () => {
    const streak = computePracticeStreak([attempt("BTN", true, NOW.toISOString())], NOW);
    expect(streak.todayCount).toBe(1);
    expect(streak.currentStreakDays).toBe(1);
  });

  it("counts multiple attempts on the same today", () => {
    const streak = computePracticeStreak(
      [attempt("BTN", true, NOW.toISOString()), attempt("BB", false, NOW.toISOString())],
      NOW
    );
    expect(streak.todayCount).toBe(2);
  });

  it("extends the streak across consecutive prior days", () => {
    const days = [0, 1, 2, 3].map((offset) => {
      const d = new Date(NOW);
      d.setDate(d.getDate() - offset);
      return attempt("BTN", true, d.toISOString());
    });
    const streak = computePracticeStreak(days, NOW);
    expect(streak.currentStreakDays).toBe(4);
  });

  it("doesn't zero out the streak just because today has no attempts yet", () => {
    const yesterday = new Date(NOW);
    yesterday.setDate(yesterday.getDate() - 1);
    const streak = computePracticeStreak([attempt("BTN", true, yesterday.toISOString())], NOW);
    expect(streak.todayCount).toBe(0);
    expect(streak.currentStreakDays).toBe(1);
  });

  it("breaks the streak on a gap day", () => {
    const twoDaysAgo = new Date(NOW);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    // Nothing yesterday, so the streak can't reach back to two days ago even though that day has an attempt.
    const streak = computePracticeStreak([attempt("BTN", true, twoDaysAgo.toISOString())], NOW);
    expect(streak.currentStreakDays).toBe(0);
  });

  it("returns zero for an empty history", () => {
    const streak = computePracticeStreak([], NOW);
    expect(streak).toEqual({ todayCount: 0, currentStreakDays: 0 });
  });
});
