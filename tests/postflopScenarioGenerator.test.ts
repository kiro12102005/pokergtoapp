import { describe, it, expect } from "vitest";
import { seededRandom } from "@/domain/cards/deck";
import { generateRandomPostflopScenario } from "@/domain/scenario/postflopScenarioGenerator";
import { trackStreetBetting } from "@/domain/scenario/potCalculator";

function cardKey(c: { rank: number; suit: string }): string {
  return `${c.rank}${c.suit}`;
}

describe("generateRandomPostflopScenario", () => {
  it("produces internally consistent hands across many random draws", () => {
    for (let seed = 0; seed < 200; seed++) {
      const random = seededRandom(seed);
      const scenario = generateRandomPostflopScenario(random);

      expect(scenario.street).toBe("flop");
      expect(scenario.heroPosition).not.toBe(scenario.villainPosition);
      expect(scenario.board).toHaveLength(3);
      // Buckets are [100, 60, 40, 25] BB with up to 1.2x jitter (see generateRandomPostflopScenario).
      expect(scenario.effectiveStackBB).toBeGreaterThanOrEqual(20);
      expect(scenario.effectiveStackBB).toBeLessThanOrEqual(120);

      // No duplicate cards between hero's hand and the board.
      const allCards = [...scenario.heroCards, ...scenario.board];
      const keys = allCards.map(cardKey);
      expect(new Set(keys).size).toBe(keys.length);

      // Preflop: exactly one raise and one call, both from hero/villain, everyone else folds.
      const preflop = scenario.actionsByStreet.preflop ?? [];
      const raises = preflop.filter((e) => e.action === "raise");
      const calls = preflop.filter((e) => e.action === "call");
      const folds = preflop.filter((e) => e.action === "fold");
      expect(raises).toHaveLength(1);
      expect(calls).toHaveLength(1);
      expect(folds).toHaveLength(4);
      expect(new Set([raises[0].position, calls[0].position])).toEqual(
        new Set([scenario.heroPosition, scenario.villainPosition])
      );

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
  });

  it("is deterministic for a given seed", () => {
    const a = generateRandomPostflopScenario(seededRandom(42));
    const b = generateRandomPostflopScenario(seededRandom(42));
    expect(a).toEqual(b);
  });
});
