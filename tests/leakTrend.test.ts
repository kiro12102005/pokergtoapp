import { describe, it, expect } from "vitest";
import { computeWeeklyMatchRate } from "@/engine/history/leakTrend";
import { HandRecord, HandRecordSnapshot } from "@/engine/history/handRecord";
import { AnalyzeResultDisplay } from "@/engine/advisor/types";
import { Card } from "@/domain/cards/card";
import { Position } from "@/domain/table/seats";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

const dummySnapshot: HandRecordSnapshot = {
  format: "tournament",
  street: "preflop",
  heroPosition: "BTN",
  effectiveStackBB: 100,
  startingPotBB: 1.5,
  potBB: 1.5,
  board: [],
  heroCards: [card(14, "s"), card(13, "s")],
  actionsByStreet: {},
  otherPlayers: [],
  villainRanges: {},
};

function fakeRecord(id: string, createdAt: string, results: AnalyzeResultDisplay[]): HandRecord {
  return {
    id,
    createdAt,
    memo: null,
    snapshot: dummySnapshot,
    results,
    externalPrompt: "",
    isPublic: false,
  };
}

const matched = (position: Position = "BTN"): AnalyzeResultDisplay => ({
  street: "preflop",
  source: "exact",
  frequencies: { raise: 1 },
  actualAction: { position, action: "raise" },
});

const mismatched = (position: Position = "BTN"): AnalyzeResultDisplay => ({
  street: "preflop",
  source: "exact",
  frequencies: { raise: 1 },
  actualAction: { position, action: "fold" },
});

describe("computeWeeklyMatchRate", () => {
  it("buckets decisions by the Monday-starting week of their record's createdAt", () => {
    // 2026-08-10 is a Monday; 2026-08-12 (Wed) is the same week.
    const records = [
      fakeRecord("1", "2026-08-10T00:00:00Z", [matched(), matched(), matched()]),
      fakeRecord("2", "2026-08-12T00:00:00Z", [mismatched()]),
      // 2026-08-17 is the following Monday - a different week bucket.
      fakeRecord("3", "2026-08-17T00:00:00Z", [matched(), matched(), matched()]),
    ];
    const weeks = computeWeeklyMatchRate(records);
    expect(weeks).toEqual([
      { weekStart: "2026-08-10", total: 4, matches: 3 },
      { weekStart: "2026-08-17", total: 3, matches: 3 },
    ]);
  });

  it("omits a week below the minimum sample size", () => {
    const records = [fakeRecord("1", "2026-08-10T00:00:00Z", [matched(), matched()])];
    expect(computeWeeklyMatchRate(records)).toEqual([]);
  });

  it("returns weeks sorted oldest first", () => {
    const records = [
      fakeRecord("1", "2026-08-17T00:00:00Z", [matched(), matched(), matched()]),
      fakeRecord("2", "2026-08-03T00:00:00Z", [matched(), matched(), matched()]),
      fakeRecord("3", "2026-08-10T00:00:00Z", [matched(), matched(), matched()]),
    ];
    const weeks = computeWeeklyMatchRate(records);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-08-03", "2026-08-10", "2026-08-17"]);
  });

  it("caps the result to the most recent MAX_WEEKS weeks", () => {
    const records = Array.from({ length: 20 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 0, 5 + i * 7)); // consecutive Mondays
      return fakeRecord(String(i), date.toISOString(), [matched(), matched(), matched()]);
    });
    const weeks = computeWeeklyMatchRate(records);
    expect(weeks.length).toBe(12);
    // The 12 most recent weeks, still oldest-first.
    expect(weeks[0].weekStart < weeks[weeks.length - 1].weekStart).toBe(true);
  });

  it("ignores preview results (no actualAction) and errored results (no frequencies)", () => {
    const records = [
      fakeRecord("1", "2026-08-10T00:00:00Z", [
        { street: "preflop", source: "exact", frequencies: { raise: 1 } },
        { street: "flop", source: "error", actualAction: { position: "BTN", action: "call" } },
        matched(),
        matched(),
        matched(),
      ]),
    ];
    expect(computeWeeklyMatchRate(records)).toEqual([{ weekStart: "2026-08-10", total: 3, matches: 3 }]);
  });
});
