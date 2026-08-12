import { describe, it, expect } from "vitest";
import { DEFAULT_HISTORY_FILTER, HistoryFilter, hasActiveFilter, recordMatchesFilter } from "@/engine/history/filterRecords";
import { HandRecord, HandRecordSnapshot } from "@/engine/history/handRecord";
import { AnalyzeResultDisplay } from "@/engine/advisor/types";
import { Card } from "@/domain/cards/card";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

const dummySnapshot: HandRecordSnapshot = {
  format: "tournament",
  cashRake: 0,
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

function fakeRecord(results: AnalyzeResultDisplay[]): HandRecord {
  return {
    id: "1",
    createdAt: "2026-08-11T00:00:00Z",
    memo: null,
    snapshot: dummySnapshot,
    results,
    externalPrompt: "",
    isPublic: false,
    aiFeedback: null,
    tags: [],
  };
}

describe("hasActiveFilter", () => {
  it("is false for the default filter", () => {
    expect(hasActiveFilter(DEFAULT_HISTORY_FILTER)).toBe(false);
  });

  it("is true when any dimension is set", () => {
    expect(hasActiveFilter({ ...DEFAULT_HISTORY_FILTER, position: "BTN" })).toBe(true);
    expect(hasActiveFilter({ ...DEFAULT_HISTORY_FILTER, street: "flop" })).toBe(true);
    expect(hasActiveFilter({ ...DEFAULT_HISTORY_FILTER, match: "matched" })).toBe(true);
  });
});

describe("recordMatchesFilter", () => {
  const record = fakeRecord([
    { street: "preflop", source: "exact", frequencies: { raise: 0.9, fold: 0.1 }, actualAction: { position: "BTN", action: "raise" } },
    { street: "flop", source: "llm", frequencies: { call: 0.7, fold: 0.3 }, actualAction: { position: "BB", action: "fold" } },
  ]);

  it("matches everything when no filter is active", () => {
    expect(recordMatchesFilter(record, DEFAULT_HISTORY_FILTER)).toBe(true);
  });

  it("filters by position", () => {
    expect(recordMatchesFilter(record, { ...DEFAULT_HISTORY_FILTER, position: "BTN" })).toBe(true);
    expect(recordMatchesFilter(record, { ...DEFAULT_HISTORY_FILTER, position: "SB" })).toBe(false);
  });

  it("filters by street", () => {
    expect(recordMatchesFilter(record, { ...DEFAULT_HISTORY_FILTER, street: "flop" })).toBe(true);
    expect(recordMatchesFilter(record, { ...DEFAULT_HISTORY_FILTER, street: "river" })).toBe(false);
  });

  it("filters by whether the actual action matched the recommendation", () => {
    // preflop decision matched (raise was the top frequency); flop decision did not (call was).
    expect(recordMatchesFilter(record, { ...DEFAULT_HISTORY_FILTER, match: "matched" })).toBe(true);
    expect(recordMatchesFilter(record, { ...DEFAULT_HISTORY_FILTER, match: "mismatched" })).toBe(true);
  });

  it("requires a single decision to satisfy every active dimension at once", () => {
    // BTN only appears on the matched (preflop) decision, not the mismatched (flop) one.
    const filter: HistoryFilter = { position: "BTN", street: "all", match: "mismatched" };
    expect(recordMatchesFilter(record, filter)).toBe(false);
  });

  it("excludes a preview result (no actualAction) from the match dimension", () => {
    const preview = fakeRecord([{ street: "preflop", source: "exact", frequencies: { raise: 1 } }]);
    expect(recordMatchesFilter(preview, { ...DEFAULT_HISTORY_FILTER, match: "matched" })).toBe(false);
  });
});
