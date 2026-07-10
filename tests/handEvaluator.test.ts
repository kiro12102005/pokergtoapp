import { describe, it, expect } from "vitest";
import { cardFromString } from "@/domain/cards/card";
import { evaluate5 } from "@/engine/equity/handEvaluator";
import { evaluateBestOf7 } from "@/engine/equity/sevenCardEvaluator";

function hand(cardsStr: string[]) {
  return cardsStr.map(cardFromString);
}

describe("evaluate5", () => {
  it("ranks hand categories correctly (higher category always wins)", () => {
    const royalFlush = evaluate5(hand(["As", "Ks", "Qs", "Js", "Ts"]));
    const straightFlush = evaluate5(hand(["9h", "8h", "7h", "6h", "5h"]));
    const quads = evaluate5(hand(["Ac", "Ad", "Ah", "As", "Kd"]));
    const fullHouse = evaluate5(hand(["Kc", "Kd", "Kh", "2s", "2d"]));
    const flush = evaluate5(hand(["2h", "5h", "9h", "Jh", "Kh"]));
    const straight = evaluate5(hand(["5c", "6d", "7h", "8s", "9d"]));
    const trips = evaluate5(hand(["7c", "7d", "7h", "2s", "9d"]));
    const twoPair = evaluate5(hand(["9c", "9d", "3h", "3s", "Kd"]));
    const onePair = evaluate5(hand(["4c", "4d", "9h", "Js", "Kd"]));
    const highCard = evaluate5(hand(["2c", "5d", "9h", "Js", "Kd"]));

    expect(royalFlush).toBeGreaterThan(straightFlush);
    expect(straightFlush).toBeGreaterThan(quads);
    expect(quads).toBeGreaterThan(fullHouse);
    expect(fullHouse).toBeGreaterThan(flush);
    expect(flush).toBeGreaterThan(straight);
    expect(straight).toBeGreaterThan(trips);
    expect(trips).toBeGreaterThan(twoPair);
    expect(twoPair).toBeGreaterThan(onePair);
    expect(onePair).toBeGreaterThan(highCard);
  });

  it("treats the wheel (A-2-3-4-5) as a 5-high straight", () => {
    const wheel = evaluate5(hand(["As", "2d", "3h", "4s", "5c"]));
    const sixHighStraight = evaluate5(hand(["2s", "3d", "4h", "5s", "6c"]));
    expect(sixHighStraight).toBeGreaterThan(wheel);
  });

  it("breaks ties within a category by kicker", () => {
    const acesKingKicker = evaluate5(hand(["Ac", "Ad", "9h", "Js", "Kd"]));
    const acesQueenKicker = evaluate5(hand(["Ah", "As", "9d", "Js", "Qd"]));
    expect(acesKingKicker).toBeGreaterThan(acesQueenKicker);
  });
});

describe("evaluateBestOf7", () => {
  it("picks the best 5 of 7 cards", () => {
    const score = evaluateBestOf7(
      hand(["As", "Ks", "Qs", "Js", "Ts", "2c", "3d"])
    );
    const royalFlushScore = evaluate5(hand(["As", "Ks", "Qs", "Js", "Ts"]));
    expect(score).toBe(royalFlushScore);
  });
});
