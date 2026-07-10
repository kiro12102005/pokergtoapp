import { describe, it, expect } from "vitest";
import { chenScore, defaultRangeHands, defaultRangePercent } from "@/engine/equity/handStrength";

describe("chenScore", () => {
  it("ranks AA highest", () => {
    const aa = chenScore("AA");
    expect(aa).toBeGreaterThan(chenScore("KK"));
    expect(aa).toBeGreaterThan(chenScore("AKs"));
  });

  it("matches the well-known Chen value for AKs (12)", () => {
    expect(chenScore("AKs")).toBeCloseTo(12, 5);
  });

  it("scores 72o as one of the weakest hands", () => {
    const worst = Math.min(...["72o", "83o", "94o", "T5o"].map(chenScore));
    expect(chenScore("72o")).toBeCloseTo(worst, 5);
  });

  it("suited beats offsuit for the same ranks", () => {
    expect(chenScore("JTs")).toBeGreaterThan(chenScore("JTo"));
  });

  it("connectors score higher than a big gap of the same high card", () => {
    expect(chenScore("T9o")).toBeGreaterThan(chenScore("T4o"));
  });
});

describe("defaultRangeHands", () => {
  it("always includes AA at any range width", () => {
    expect(defaultRangeHands(5)).toContain("AA");
    expect(defaultRangeHands(50)).toContain("AA");
  });

  it("returns a strictly wider hand list for a larger percentage", () => {
    const narrow = defaultRangeHands(10);
    const wide = defaultRangeHands(40);
    expect(wide.length).toBeGreaterThan(narrow.length);
    for (const hand of narrow) expect(wide).toContain(hand);
  });

  it("never returns an empty range", () => {
    expect(defaultRangeHands(1).length).toBeGreaterThan(0);
  });

  it("returns at most all 169 hands for 100%", () => {
    expect(defaultRangeHands(100).length).toBeLessThanOrEqual(169);
  });
});

describe("defaultRangePercent", () => {
  it("centers around ~30% (the reported average VPIP) at a typical mid stack depth", () => {
    expect(defaultRangePercent(25, 6)).toBeCloseTo(30, 5);
  });

  it("is tighter for deep/early-game stacks than for the mid-depth baseline", () => {
    expect(defaultRangePercent(100, 6)).toBeLessThan(defaultRangePercent(25, 6));
  });

  it("is much wider for short/late-game stacks than for the mid-depth baseline", () => {
    expect(defaultRangePercent(5, 6)).toBeGreaterThan(defaultRangePercent(25, 6));
  });

  it("widens further as fewer players remain at the table, holding stack depth fixed", () => {
    const fullTable = defaultRangePercent(25, 6);
    const shortHanded = defaultRangePercent(25, 3);
    expect(shortHanded).toBeGreaterThan(fullTable);
  });

  it("defaults to a full 6-max table when player count is omitted", () => {
    expect(defaultRangePercent(25)).toBeCloseTo(defaultRangePercent(25, 6), 5);
  });

  it("never exceeds 100%", () => {
    expect(defaultRangePercent(1, 2)).toBeLessThanOrEqual(100);
  });
});
