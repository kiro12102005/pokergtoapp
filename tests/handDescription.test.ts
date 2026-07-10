import { describe, it, expect } from "vitest";
import { describeHandCategoryJa, evaluateBestHand } from "@/engine/equity/handDescription";
import { Card } from "@/domain/cards/card";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("evaluateBestHand / describeHandCategoryJa", () => {
  it("correctly identifies two pair (not a straight) on an A-J-T-Q board with hole AJ", () => {
    // The reported bug: board A-J-T-Q is one card (a king) short of a straight, and hero's
    // AJ only makes two pair (aces and jacks) - it must not be misread as a straight.
    const heroCards = [card(14, "s"), card(11, "h")]; // A J
    const board = [card(14, "c"), card(11, "d"), card(10, "s"), card(12, "h")]; // A J T Q
    const score = evaluateBestHand([...heroCards, ...board]);
    expect(describeHandCategoryJa(score)).toBe("ツーペア");
  });

  it("identifies a real straight when the gap card is present", () => {
    const heroCards = [card(14, "s"), card(13, "h")]; // A K
    const board = [card(12, "c"), card(11, "d"), card(10, "s")]; // Q J T -> A-K-Q-J-T straight
    const score = evaluateBestHand([...heroCards, ...board]);
    expect(describeHandCategoryJa(score)).toBe("ストレート");
  });

  it("works for a 5-card (flop) hand", () => {
    const heroCards = [card(2, "s"), card(2, "h")];
    const board = [card(2, "c"), card(9, "d"), card(4, "s")];
    const score = evaluateBestHand([...heroCards, ...board]);
    expect(describeHandCategoryJa(score)).toBe("スリーカード");
  });

  it("works for a 7-card (river) hand", () => {
    const heroCards = [card(5, "s"), card(5, "h")];
    const board = [card(5, "c"), card(5, "d"), card(9, "s"), card(2, "h"), card(3, "c")];
    const score = evaluateBestHand([...heroCards, ...board]);
    expect(describeHandCategoryJa(score)).toBe("フォーカード");
  });

  it("throws for fewer than 5 cards", () => {
    expect(() => evaluateBestHand([card(2, "s"), card(3, "h")])).toThrow();
  });
});
