import { describe, it, expect } from "vitest";
import { buildHandRecordSnapshot, handRecordFromRow, HandRecordDraft, HandRecordRow } from "@/engine/history/handRecord";
import { Card } from "@/domain/cards/card";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

const baseDraft: HandRecordDraft = {
  street: "flop",
  heroPosition: "BB",
  effectiveStackBB: 80,
  startingPotBB: 1.5,
  board: [card(14, "s"), card(7, "h"), card(2, "d")],
  heroCards: [card(13, "s"), card(13, "h")],
  actionsByStreet: {
    preflop: [{ position: "BTN", action: "raise", sizeBB: 2.5 }, { position: "BB", action: "call" }],
    flop: [{ position: "BB", action: "check" }],
    turn: [{ position: "BB", action: "check" }],
  },
  otherPlayers: [],
  extraContext: "",
  villainRanges: {},
};

describe("buildHandRecordSnapshot", () => {
  it("returns null when hero's hand isn't fully picked", () => {
    expect(buildHandRecordSnapshot({ ...baseDraft, heroCards: [null, null] })).toBeNull();
    expect(buildHandRecordSnapshot({ ...baseDraft, heroCards: [card(13, "s"), null] })).toBeNull();
  });

  it("filters unset board slots down to only the picked cards", () => {
    const snapshot = buildHandRecordSnapshot({ ...baseDraft, board: [card(14, "s"), null, null] });
    expect(snapshot?.board).toEqual([card(14, "s")]);
  });

  it("truncates action history to streets up to and including the current one", () => {
    const snapshot = buildHandRecordSnapshot(baseDraft);
    expect(snapshot?.actionsByStreet.turn).toBeUndefined();
    expect(snapshot?.actionsByStreet.flop).toHaveLength(1);
    expect(snapshot?.actionsByStreet.preflop).toHaveLength(2);
  });

  it("precomputes the pot at the snapshot's street", () => {
    const snapshot = buildHandRecordSnapshot(baseDraft);
    // 1.5 starting (blinds) + 4.0 new preflop money (BTN's 2.5 + BB's 1.5 to call) = 5.5, flop has no bets yet.
    expect(snapshot?.potBB).toBeCloseTo(5.5);
  });

  it("trims blank extra context down to undefined", () => {
    const snapshot = buildHandRecordSnapshot({ ...baseDraft, extraContext: "   " });
    expect(snapshot?.extraContext).toBeUndefined();
  });

  it("keeps non-blank extra context", () => {
    const snapshot = buildHandRecordSnapshot({ ...baseDraft, extraContext: " 相手はタイト " });
    expect(snapshot?.extraContext).toBe("相手はタイト");
  });
});

describe("handRecordFromRow", () => {
  it("maps snake_case row fields to the camelCase HandRecord shape", () => {
    const snapshot = buildHandRecordSnapshot(baseDraft)!;
    const row: HandRecordRow = {
      id: "abc-123",
      created_at: "2026-08-09T12:00:00Z",
      memo: "覚え書き",
      snapshot,
      results: [],
      external_prompt: "## シチュエーション\n...",
      is_public: true,
    };
    const record = handRecordFromRow(row);
    expect(record).toEqual({
      id: "abc-123",
      createdAt: "2026-08-09T12:00:00Z",
      memo: "覚え書き",
      snapshot,
      results: [],
      externalPrompt: "## シチュエーション\n...",
      isPublic: true,
    });
  });
});
