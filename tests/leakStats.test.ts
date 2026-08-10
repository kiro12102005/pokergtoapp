import { describe, it, expect } from "vitest";
import { computeLeakStats } from "@/engine/history/leakStats";
import { HandRecord, HandRecordSnapshot } from "@/engine/history/handRecord";
import { AnalyzeResultDisplay } from "@/engine/advisor/types";
import { Card } from "@/domain/cards/card";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

const dummySnapshot: HandRecordSnapshot = {
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

function fakeRecord(id: string, results: AnalyzeResultDisplay[]): HandRecord {
  return { id, createdAt: "2026-08-11T00:00:00Z", memo: null, snapshot: dummySnapshot, results, externalPrompt: "" };
}

describe("computeLeakStats", () => {
  it("omits actualAction-less results (previews) and errored results", () => {
    const records = [
      fakeRecord("1", [
        { street: "preflop", source: "exact", frequencies: { raise: 1 } }, // no actualAction
        { street: "flop", source: "error", actualAction: { position: "BTN", action: "call" } }, // no frequencies
      ]),
    ];
    const stats = computeLeakStats(records);
    expect(stats.totalDecisions).toBe(0);
  });

  it("counts a match when the actual action equals the highest-frequency recommendation", () => {
    const records = [
      fakeRecord("1", [
        { street: "preflop", source: "exact", frequencies: { raise: 0.9, fold: 0.1 }, actualAction: { position: "BTN", action: "raise" } },
      ]),
    ];
    const stats = computeLeakStats(records);
    expect(stats.totalDecisions).toBe(1);
    expect(stats.totalMatches).toBe(1);
  });

  it("counts a mismatch when the actual action differs from the recommendation", () => {
    const records = [
      fakeRecord("1", [
        { street: "preflop", source: "exact", frequencies: { raise: 0.9, fold: 0.1 }, actualAction: { position: "BTN", action: "fold" } },
      ]),
    ];
    const stats = computeLeakStats(records);
    expect(stats.totalDecisions).toBe(1);
    expect(stats.totalMatches).toBe(0);
  });

  it("aggregates by street and by position, sorted ascending by match rate, above the sample-size floor", () => {
    const results: AnalyzeResultDisplay[] = [
      // BTN preflop: 1/3 match (weak spot)
      { street: "preflop", source: "exact", frequencies: { raise: 1 }, actualAction: { position: "BTN", action: "raise" } },
      { street: "preflop", source: "exact", frequencies: { raise: 1 }, actualAction: { position: "BTN", action: "fold" } },
      { street: "preflop", source: "exact", frequencies: { raise: 1 }, actualAction: { position: "BTN", action: "fold" } },
      // flop (BB): 3/3 match (strong)
      { street: "flop", source: "llm", frequencies: { call: 1 }, actualAction: { position: "BB", action: "call" } },
      { street: "flop", source: "llm", frequencies: { call: 1 }, actualAction: { position: "BB", action: "call" } },
      { street: "flop", source: "llm", frequencies: { call: 1 }, actualAction: { position: "BB", action: "call" } },
    ];
    const stats = computeLeakStats([fakeRecord("1", results)]);

    expect(stats.totalDecisions).toBe(6);
    expect(stats.totalMatches).toBe(4);

    expect(stats.byStreet.map((s) => s.street)).toEqual(["preflop", "flop"]);
    expect(stats.byStreet[0]).toMatchObject({ street: "preflop", total: 3, matches: 1 });
    expect(stats.byStreet[1]).toMatchObject({ street: "flop", total: 3, matches: 3 });

    expect(stats.byPosition.map((p) => p.position)).toEqual(["BTN", "BB"]);
  });

  it("omits a category with fewer than the minimum sample size", () => {
    const results: AnalyzeResultDisplay[] = [
      { street: "river", source: "llm", frequencies: { fold: 1 }, actualAction: { position: "SB", action: "fold" } },
      { street: "river", source: "llm", frequencies: { fold: 1 }, actualAction: { position: "SB", action: "fold" } },
    ];
    const stats = computeLeakStats([fakeRecord("1", results)]);
    expect(stats.totalDecisions).toBe(2); // still counted in the overall total
    expect(stats.byStreet).toEqual([]); // but too few samples to break out by street
    expect(stats.byPosition).toEqual([]);
  });
});
