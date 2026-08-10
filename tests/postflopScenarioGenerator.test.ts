import { describe, it, expect } from "vitest";
import { seededRandom } from "@/domain/cards/deck";
import { describePreflopPot, generateRandomPostflopScenario } from "@/domain/scenario/postflopScenarioGenerator";
import { trackStreetBetting } from "@/domain/scenario/potCalculator";

function cardKey(c: { rank: number; suit: string }): string {
  return `${c.rank}${c.suit}`;
}

describe("generateRandomPostflopScenario", () => {
  it("produces internally consistent hands across many random draws (single-raised and 3-bet pots)", () => {
    let sawSingleRaisedPot = false;
    let sawThreeBetPot = false;

    for (let seed = 0; seed < 400; seed++) {
      const random = seededRandom(seed);
      const scenario = generateRandomPostflopScenario(random);

      expect(scenario.street).toBe("flop");
      expect(scenario.heroPosition).not.toBe(scenario.villainPosition);
      expect(scenario.board).toHaveLength(3);

      // No duplicate cards between hero's hand and the board.
      const allCards = [...scenario.heroCards, ...scenario.board];
      const keys = allCards.map(cardKey);
      expect(new Set(keys).size).toBe(keys.length);

      const preflop = scenario.actionsByStreet.preflop ?? [];
      const raises = preflop.filter((e) => e.action === "raise");
      const calls = preflop.filter((e) => e.action === "call");
      const folds = preflop.filter((e) => e.action === "fold");
      expect(folds).toHaveLength(4);
      expect(calls).toHaveLength(1);

      const { isThreeBetPot, openerPosition, responderPosition } = describePreflopPot(preflop);
      expect(new Set([openerPosition, responderPosition])).toEqual(
        new Set([scenario.heroPosition, scenario.villainPosition])
      );

      if (isThreeBetPot) {
        sawThreeBetPot = true;
        // open-raise + 3-bet, then the opener's call.
        expect(raises).toHaveLength(2);
        expect(raises[0].position).toBe(openerPosition);
        expect(raises[1].position).toBe(responderPosition);
        expect(raises[1].sizeBB).toBeGreaterThan(raises[0].sizeBB!);
        expect(calls[0].position).toBe(openerPosition);
        // Deeper stacks only, so postflop SPR isn't trivially shove-or-fold after a 3-bet.
        expect(scenario.effectiveStackBB).toBeGreaterThanOrEqual(48);
      } else {
        sawSingleRaisedPot = true;
        expect(raises).toHaveLength(1);
        expect(raises[0].position).toBe(openerPosition);
        expect(calls[0].position).toBe(responderPosition);
        expect(scenario.effectiveStackBB).toBeGreaterThanOrEqual(20);
      }
      expect(scenario.effectiveStackBB).toBeLessThanOrEqual(120);

      const flop = scenario.actionsByStreet.flop ?? [];
      if (scenario.facingBet) {
        expect(flop).toHaveLength(1);
        expect(flop[0].position).toBe(scenario.villainPosition);
        expect(flop[0].action).toBe("raise");
        expect(flop[0].sizeBB).toBeGreaterThan(0);
      } else {
        expect(flop).toHaveLength(0);
      }

      // The preflop history is a well-formed betting sequence (no negative/invalid state).
      const preflopBetting = trackStreetBetting("preflop", preflop);
      expect(preflopBetting.betToLevel).toBeGreaterThan(0);
    }

    expect(sawSingleRaisedPot).toBe(true);
    expect(sawThreeBetPot).toBe(true);
  });

  it("is deterministic for a given seed", () => {
    const a = generateRandomPostflopScenario(seededRandom(42));
    const b = generateRandomPostflopScenario(seededRandom(42));
    expect(a).toEqual(b);
  });
});

describe("describePreflopPot", () => {
  it("identifies a single-raised pot", () => {
    const summary = describePreflopPot([
      { position: "BTN", action: "raise", sizeBB: 2.5 },
      { position: "BB", action: "call" },
    ]);
    expect(summary).toEqual({ isThreeBetPot: false, openerPosition: "BTN", responderPosition: "BB" });
  });

  it("identifies a 3-bet pot and its opener/responder regardless of fold noise", () => {
    const summary = describePreflopPot([
      { position: "UTG", action: "fold" },
      { position: "HJ", action: "raise", sizeBB: 2.5 },
      { position: "CO", action: "fold" },
      { position: "BTN", action: "raise", sizeBB: 10 },
      { position: "SB", action: "fold" },
      { position: "HJ", action: "call" },
    ]);
    expect(summary).toEqual({ isThreeBetPot: true, openerPosition: "HJ", responderPosition: "BTN" });
  });
});
