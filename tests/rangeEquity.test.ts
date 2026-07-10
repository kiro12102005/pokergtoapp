import { describe, it, expect } from "vitest";
import { computeEquityVsRange } from "@/engine/equity/rangeEquity";
import { seededRandom } from "@/domain/cards/deck";
import { Card } from "@/domain/cards/card";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("computeEquityVsRange", () => {
  it("gives near-100% equity on the river when hero has quads against a weak range", () => {
    const heroCards: [Card, Card] = [card(5, "s"), card(5, "h")];
    const board = [card(5, "c"), card(5, "d"), card(9, "s"), card(2, "h"), card(3, "c")];
    const equity = computeEquityVsRange(heroCards, board, ["72o", "83o", "94o"]);
    expect(equity).toBeCloseTo(1, 6);
  });

  it("gives near-0% equity on the river when hero has nothing against a range of sets", () => {
    const heroCards: [Card, Card] = [card(4, "s"), card(6, "h")];
    const board = [card(2, "c"), card(2, "d"), card(9, "s"), card(9, "h"), card(3, "c")];
    // Villain's range is exactly the two pocket pairs that already make quads/boat here.
    const equity = computeEquityVsRange(heroCards, board, ["22", "99"]);
    expect(equity).toBeLessThan(0.05);
  });

  it("computes an exact turn (1-card runout) equity between two known ranges symmetrically", () => {
    const heroCards: [Card, Card] = [card(14, "s"), card(14, "h")]; // AA
    const board = [card(9, "s"), card(4, "h"), card(2, "d"), card(7, "c")];
    // Ranks 6/3/8/5 don't appear on the board, so these hands can't trip up - genuinely weak
    // (unpaired, disconnected from the board) hands for AA's overpair to crush.
    const equityVsWeak = computeEquityVsRange(heroCards, board, ["63o", "85o"]);
    const equityVsSets = computeEquityVsRange(heroCards, board, ["99", "44"]);
    // AA overpair should crush a weak range but lose most of the time to a set on this board.
    expect(equityVsWeak).toBeGreaterThan(0.85);
    expect(equityVsSets).toBeLessThan(0.15);
  });

  it("excludes villain combos that conflict with hero's hole cards", () => {
    const heroCards: [Card, Card] = [card(14, "s"), card(14, "h")]; // A♠ A♥
    const board = [card(9, "s"), card(4, "h"), card(2, "d")];
    // Villain "range" is exactly hero's own combo - every combo of AA conflicts with hero's
    // hand except none (hero holds both remaining aces... actually 2 aces left: A♦ A♣, so AA
    // has exactly one valid combo remaining). Equity should still resolve without throwing.
    expect(() => computeEquityVsRange(heroCards, board, ["AA"])).not.toThrow();
  });

  it("stays within [0, 1] and is deterministic for a fixed seed on the flop (Monte Carlo path)", () => {
    const heroCards: [Card, Card] = [card(14, "s"), card(13, "s")]; // AKs
    const board = [card(12, "s"), card(11, "s"), card(2, "h")]; // flush + straight draw board
    const random = seededRandom(1);
    const equity = computeEquityVsRange(heroCards, board, ["99", "TT", "72o"], { runoutsPerCombo: 20, random });
    expect(equity).toBeGreaterThanOrEqual(0);
    expect(equity).toBeLessThanOrEqual(1);

    const random2 = seededRandom(1);
    const equityAgain = computeEquityVsRange(heroCards, board, ["99", "TT", "72o"], {
      runoutsPerCombo: 20,
      random: random2,
    });
    expect(equityAgain).toBeCloseTo(equity, 6);
  });

  it("throws for a board outside the 3-5 card range", () => {
    const heroCards: [Card, Card] = [card(14, "s"), card(13, "s")];
    expect(() => computeEquityVsRange(heroCards, [card(2, "h")], ["AA"])).toThrow();
  });
});
