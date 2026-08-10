import { describe, it, expect } from "vitest";
import { summarizePreflopAttempts, PreflopAttemptRecord } from "@/engine/history/preflopStats";

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
