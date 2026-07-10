import { describe, it, expect } from "vitest";
import { seededRandom } from "@/domain/cards/deck";
import { canonicalHandVsHandEquity } from "@/engine/equity/equityCalculator";

describe("canonicalHandVsHandEquity", () => {
  it("gives AA a big edge over 72o", () => {
    const equity = canonicalHandVsHandEquity("AA", "72o", {
      comboPairSamples: 8,
      runoutsPerComboPair: 40,
      random: seededRandom(1),
    });
    expect(equity).toBeGreaterThan(0.75);
  });

  it("is close to 50/50 for symmetric coinflip-ish matchups (AKo vs QQ roughly a coinflip)", () => {
    const equity = canonicalHandVsHandEquity("AKo", "QQ", {
      comboPairSamples: 8,
      runoutsPerComboPair: 40,
      random: seededRandom(2),
    });
    expect(equity).toBeGreaterThan(0.35);
    expect(equity).toBeLessThan(0.65);
  });

  it("mirror matchup is exactly 0.5", () => {
    expect(canonicalHandVsHandEquity("KQs", "KQs")).toBe(0.5);
  });
});
