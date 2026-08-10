import { describe, it, expect } from "vitest";
import { seededRandom } from "@/domain/cards/deck";
import { describePreflopPot, generateRandomPostflopScenario, PostflopStreet } from "@/domain/scenario/postflopScenarioGenerator";
import { trackStreetBetting } from "@/domain/scenario/potCalculator";
import { Street } from "@/domain/scenario/scenarioState";

function cardKey(c: { rank: number; suit: string }): string {
  return `${c.rank}${c.suit}`;
}

const BOARD_SIZE_FOR_STREET: Record<PostflopStreet, number> = { flop: 3, turn: 4, river: 5 };
const POSTFLOP_STREET_ORDER: PostflopStreet[] = ["flop", "turn", "river"];

describe("generateRandomPostflopScenario", () => {
  it("produces internally consistent hands across many random draws (single-raised, 3-bet, multiway pots, all target streets)", () => {
    let sawSingleRaisedPot = false;
    let sawThreeBetPot = false;
    let sawMultiway = false;
    const seenStreets = new Set<PostflopStreet>();

    for (let seed = 0; seed < 1500; seed++) {
      const random = seededRandom(seed);
      const scenario = generateRandomPostflopScenario(random);
      seenStreets.add(scenario.street);

      expect(scenario.heroPosition).not.toBe(scenario.villainPosition);
      expect(scenario.board).toHaveLength(BOARD_SIZE_FOR_STREET[scenario.street]);

      // No duplicate cards between hero's hand and the board.
      const allCards = [...scenario.heroCards, ...scenario.board];
      const keys = allCards.map(cardKey);
      expect(new Set(keys).size).toBe(keys.length);

      const preflop = scenario.actionsByStreet.preflop ?? [];
      const raises = preflop.filter((e) => e.action === "raise");
      const calls = preflop.filter((e) => e.action === "call");
      const folds = preflop.filter((e) => e.action === "fold");

      const { isThreeBetPot, isMultiway, openerPosition } = describePreflopPot(preflop);
      expect([isThreeBetPot, isMultiway]).not.toEqual([true, true]); // mutually exclusive

      if (isMultiway) {
        sawMultiway = true;
        expect(folds).toHaveLength(3);
        expect(raises).toHaveLength(1);
        expect(calls).toHaveLength(2);
        expect(raises[0].position).toBe(openerPosition);
        // hero and villain are 2 of the 3 preflop participants (opener + 2 callers); the third
        // (whoever isn't hero/villain among them) folds when the flop begins.
        const participants = new Set([...calls.map((c) => c.position), openerPosition]);
        expect(participants.has(scenario.heroPosition)).toBe(true);
        expect(participants.has(scenario.villainPosition)).toBe(true);
        expect(participants.size).toBe(3);

        const flopActions = scenario.actionsByStreet.flop ?? [];
        const flopFolds = flopActions.filter((e) => e.action === "fold");
        expect(flopFolds).toHaveLength(1);
        expect(flopFolds[0].position).not.toBe(scenario.heroPosition);
        expect(flopFolds[0].position).not.toBe(scenario.villainPosition);
      } else {
        expect(folds).toHaveLength(4);
        const flopFolds = (scenario.actionsByStreet.flop ?? []).filter((e) => e.action === "fold");
        expect(flopFolds).toHaveLength(0);
      }

      if (isThreeBetPot) {
        sawThreeBetPot = true;
        expect(raises).toHaveLength(2);
        expect(raises[1].sizeBB).toBeGreaterThan(raises[0].sizeBB!);
        // Deeper stacks only, so postflop SPR isn't trivially shove-or-fold after a 3-bet.
        expect(scenario.effectiveStackBB).toBeGreaterThanOrEqual(48);
      } else if (!isMultiway) {
        sawSingleRaisedPot = true;
        expect(raises).toHaveLength(1);
        expect(scenario.effectiveStackBB).toBeGreaterThanOrEqual(20);
      }
      expect(scenario.effectiveStackBB).toBeLessThanOrEqual(120);

      // Every street strictly before the decision street is fully resolved (checked through, or
      // villain bet + hero called, plus the third player's flop fold when multiway); the
      // decision street itself matches `facingBet`.
      for (const street of POSTFLOP_STREET_ORDER) {
        const actions = (scenario.actionsByStreet[street] ?? []).filter((e) => e.action !== "fold");
        if (street === scenario.street) {
          if (scenario.facingBet) {
            expect(actions).toHaveLength(1);
            expect(actions[0].position).toBe(scenario.villainPosition);
            expect(actions[0].action).toBe("raise");
            expect(actions[0].sizeBB).toBeGreaterThan(0);
          } else {
            expect(actions).toHaveLength(0);
          }
          break;
        }
        expect(actions).toHaveLength(2);
        expect(new Set(actions.map((a) => a.position))).toEqual(
          new Set([scenario.heroPosition, scenario.villainPosition])
        );
        const allChecked = actions.every((a) => a.action === "check");
        const betAndCalled =
          actions.find((a) => a.position === scenario.villainPosition)?.action === "raise" &&
          actions.find((a) => a.position === scenario.heroPosition)?.action === "call";
        expect(allChecked || betAndCalled).toBe(true);
      }

      // The full history (every street up to and including the decision one) is a well-formed
      // betting sequence with no negative/invalid state.
      const allStreets: Street[] = ["preflop", ...POSTFLOP_STREET_ORDER];
      for (const street of allStreets) {
        const actions = scenario.actionsByStreet[street];
        if (actions) expect(() => trackStreetBetting(street, actions)).not.toThrow();
        if (street === scenario.street) break;
      }
    }

    expect(sawSingleRaisedPot).toBe(true);
    expect(sawThreeBetPot).toBe(true);
    expect(sawMultiway).toBe(true);
    // All three target streets should show up across enough random draws.
    expect(seenStreets).toEqual(new Set<PostflopStreet>(["flop", "turn", "river"]));
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
    expect(summary).toEqual({
      isThreeBetPot: false,
      isMultiway: false,
      openerPosition: "BTN",
      responderPosition: "BB",
    });
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
    expect(summary).toEqual({
      isThreeBetPot: true,
      isMultiway: false,
      openerPosition: "HJ",
      responderPosition: "BTN",
    });
  });

  it("identifies a multiway (call, call) pot distinctly from a 3-bet pot", () => {
    const summary = describePreflopPot([
      { position: "UTG", action: "raise", sizeBB: 2.5 },
      { position: "CO", action: "call" },
      { position: "BTN", action: "call" },
    ]);
    expect(summary).toEqual({
      isThreeBetPot: false,
      isMultiway: true,
      openerPosition: "UTG",
      responderPosition: "CO",
    });
  });
});
