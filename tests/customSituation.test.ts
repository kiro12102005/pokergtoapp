import { describe, it, expect } from "vitest";
import { boardSizeForStreet, validateCustomSituation } from "@/domain/scenario/customSituation";
import { AdvisorSituation } from "@/engine/advisor/types";
import { Card } from "@/domain/cards/card";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

const validFlopSituation: AdvisorSituation = {
  format: "tournament",
  street: "flop",
  heroPosition: "BB",
  effectiveStackBB: 80,
  potBB: 6,
  board: [card(14, "s"), card(7, "h"), card(2, "d")],
  heroCards: [card(13, "s"), card(13, "h")],
  actionsByStreet: {},
};

describe("boardSizeForStreet", () => {
  it("returns 0/3/4/5 for preflop/flop/turn/river", () => {
    expect(boardSizeForStreet("preflop")).toBe(0);
    expect(boardSizeForStreet("flop")).toBe(3);
    expect(boardSizeForStreet("turn")).toBe(4);
    expect(boardSizeForStreet("river")).toBe(5);
  });
});

describe("validateCustomSituation", () => {
  it("accepts a well-formed flop situation", () => {
    const result = validateCustomSituation(validFlopSituation);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a board with the wrong number of cards for the street", () => {
    const result = validateCustomSituation({ ...validFlopSituation, board: [card(14, "s")] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("3枚"))).toBe(true);
  });

  it("rejects duplicate cards between board and hero hand", () => {
    const result = validateCustomSituation({
      ...validFlopSituation,
      heroCards: [card(14, "s"), card(13, "h")],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-positive effective stack", () => {
    const result = validateCustomSituation({ ...validFlopSituation, effectiveStackBB: 0 });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-positive pot", () => {
    const result = validateCustomSituation({ ...validFlopSituation, potBB: 0 });
    expect(result.valid).toBe(false);
  });

  it("accepts other players with distinct positions and positive stacks", () => {
    const result = validateCustomSituation({
      ...validFlopSituation,
      otherPlayers: [
        { position: "BTN", stackBB: 40 },
        { position: "SB", stackBB: 10 },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects an other-player position that collides with the hero's position", () => {
    const result = validateCustomSituation({
      ...validFlopSituation,
      heroPosition: "BB",
      otherPlayers: [{ position: "BB", stackBB: 40 }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects duplicate other-player positions", () => {
    const result = validateCustomSituation({
      ...validFlopSituation,
      otherPlayers: [
        { position: "BTN", stackBB: 40 },
        { position: "BTN", stackBB: 20 },
      ],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-positive other-player stack", () => {
    const result = validateCustomSituation({
      ...validFlopSituation,
      otherPlayers: [{ position: "BTN", stackBB: 0 }],
    });
    expect(result.valid).toBe(false);
  });
});
