import { describe, it, expect } from "vitest";
import { computeCurrentPot } from "@/domain/scenario/potCalculator";
import { ActionEvent, Street } from "@/domain/scenario/scenarioState";

describe("computeCurrentPot", () => {
  it("returns just the starting pot when no actions have happened yet", () => {
    expect(computeCurrentPot(1.5, {}, "preflop")).toBeCloseTo(1.5, 6);
  });

  it("adds an open-raise's contribution on top of the starting pot", () => {
    // BTN raises to 2.5BB preflop - BTN already has 0 in (not a blind), so contributes 2.5.
    const pot = computeCurrentPot(1.5, { preflop: [{ position: "BTN", action: "raise", sizeBB: 2.5 }] }, "preflop");
    expect(pot).toBeCloseTo(1.5 + 2.5, 6);
  });

  it("computes a BB call correctly against the BB's standard 1BB already posted", () => {
    // BB facing a 2.5BB raise only needs to add 1.5BB more to call (already has 1BB in from
    // the blind, which the starting pot already accounts for).
    const pot = computeCurrentPot(
      1.5,
      {
        preflop: [
          { position: "BTN", action: "raise", sizeBB: 2.5 },
          { position: "BB", action: "call" },
        ],
      },
      "preflop"
    );
    expect(pot).toBeCloseTo(1.5 + 2.5 + 1.5, 6);
  });

  it("does not double count a raiser's own call-up amount, and credits SB's posted blind", () => {
    // BTN raises to 2.5 (contributes 2.5, had 0 in). SB 3bets to 10 (contributes 9.5, already
    // had the 0.5 SB blind in). BTN calls to 10 (contributes 7.5, already had 2.5 in).
    const pot = computeCurrentPot(
      1.5,
      {
        preflop: [
          { position: "BTN", action: "raise", sizeBB: 2.5 },
          { position: "SB", action: "raise", sizeBB: 10 },
          { position: "BTN", action: "call" },
        ],
      },
      "preflop"
    );
    expect(pot).toBeCloseTo(1.5 + 2.5 + 9.5 + 7.5, 6);
  });

  it("carries the preflop total forward and adds a flop bet on top", () => {
    const actionsByStreet = {
      preflop: [
        { position: "BTN", action: "raise", sizeBB: 2.5 },
        { position: "BB", action: "call" },
      ],
      flop: [{ position: "BB", action: "raise", sizeBB: 4 }],
    } satisfies Partial<Record<Street, ActionEvent[]>>;
    const potAtFlop = computeCurrentPot(1.5, actionsByStreet, "flop");
    // preflop pot: 1.5 + 2.5 + 1.5 = 5.5, then BB bets 4 more on the flop.
    expect(potAtFlop).toBeCloseTo(5.5 + 4, 6);
  });

  it("ignores actions from streets after uptoStreet", () => {
    const actionsByStreet = {
      preflop: [{ position: "BTN", action: "raise", sizeBB: 2.5 }],
      flop: [{ position: "BB", action: "raise", sizeBB: 4 }],
    } satisfies Partial<Record<Street, ActionEvent[]>>;
    const potAtPreflop = computeCurrentPot(1.5, actionsByStreet, "preflop");
    expect(potAtPreflop).toBeCloseTo(1.5 + 2.5, 6);
  });

  it("fold and check contribute nothing", () => {
    const pot = computeCurrentPot(
      1.5,
      { flop: [{ position: "BB", action: "check" }, { position: "BTN", action: "check" }] },
      "flop"
    );
    expect(pot).toBeCloseTo(1.5, 6);
  });
});
