import { describe, it, expect } from "vitest";
import { recordsToCsv, recordsToJson } from "@/engine/history/exportRecords";
import { HandRecord, HandRecordSnapshot } from "@/engine/history/handRecord";
import { Card } from "@/domain/cards/card";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

const snapshot: HandRecordSnapshot = {
  format: "tournament",
  cashRake: 0,
  street: "flop",
  heroPosition: "BTN",
  effectiveStackBB: 100,
  startingPotBB: 1.5,
  potBB: 7,
  board: [card(13, "h"), card(7, "d"), card(2, "s")],
  heroCards: [card(14, "s"), card(13, "s")],
  actionsByStreet: {},
  otherPlayers: [],
  villainRanges: {},
};

function record(id: string, memo: string | null, externalPrompt: string): HandRecord {
  return { id, createdAt: "2026-08-11T00:00:00Z", memo, snapshot, results: [], externalPrompt, isPublic: false };
}

describe("recordsToJson", () => {
  it("round-trips every field", () => {
    const records = [record("1", "テストメモ", "## シチュエーション\n...")];
    const parsed = JSON.parse(recordsToJson(records));
    expect(parsed).toEqual(records);
  });
});

describe("recordsToCsv", () => {
  it("includes a header row and one row per record", () => {
    const csv = recordsToCsv([record("1", null, "prompt text")]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "id,created_at,memo,street,hero_position,effective_stack_bb,pot_bb,hero_cards,board,external_prompt"
    );
    expect(lines).toHaveLength(2);
  });

  it("quotes and escapes a multi-line external_prompt field", () => {
    const csv = recordsToCsv([record("1", null, "line one\nline two, with a comma")]);
    expect(csv).toContain('"line one\nline two, with a comma"');
  });

  it("doubles internal quote characters", () => {
    const csv = recordsToCsv([record("1", 'a "quoted" memo', "prompt")]);
    expect(csv).toContain('"a ""quoted"" memo"');
  });

  it("renders board/hero cards as display strings", () => {
    const csv = recordsToCsv([record("1", null, "prompt")]);
    expect(csv).toContain("A♠ K♠");
    expect(csv).toContain("K♥ 7♦ 2♠");
  });
});
