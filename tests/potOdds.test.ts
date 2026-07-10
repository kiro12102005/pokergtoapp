import { describe, it, expect } from "vitest";
import { computePotOdds } from "@/domain/scenario/potOdds";
import { ActionEvent, Street } from "@/domain/scenario/scenarioState";

describe("computePotOdds", () => {
  it("returns null when hero isn't facing a bet", () => {
    expect(computePotOdds(6, { flop: [] }, "flop", "BB")).toBeNull();
    expect(computePotOdds(6, { flop: [{ position: "BB", action: "check" }] }, "flop", "BB")).toBeNull();
  });

  it("matches the textbook 33% requirement for a pot-size bet", () => {
    // Pot is 6BB entering the flop; BTN bets 6BB (pot-size) - the classic case where a caller
    // needs exactly 33% equity to break even (call 6 into a resulting 18BB pot).
    const info = computePotOdds(6, { flop: [{ position: "BTN", action: "raise", sizeBB: 6 }] }, "flop", "BB");
    expect(info).not.toBeNull();
    expect(info!.callAmount).toBeCloseTo(6, 6);
    expect(info!.potBeforeCall).toBeCloseTo(12, 6);
    expect(info!.requiredEquity).toBeCloseTo(1 / 3, 6);
  });

  it("computes a smaller required equity for a smaller bet relative to the pot", () => {
    const half = computePotOdds(10, { flop: [{ position: "BTN", action: "raise", sizeBB: 5 }] }, "flop", "BB")!;
    const full = computePotOdds(10, { flop: [{ position: "BTN", action: "raise", sizeBB: 10 }] }, "flop", "BB")!;
    expect(half.requiredEquity).toBeLessThan(full.requiredEquity);
  });

  it("only counts the delta hero must add when hero already has chips in this street", () => {
    // Hero (BB) bet 4, BTN raised to 12 - hero already has 4 in, so only needs to add 8 more.
    const actionsByStreet: Partial<Record<Street, ActionEvent[]>> = {
      flop: [
        { position: "BB", action: "raise", sizeBB: 4 },
        { position: "BTN", action: "raise", sizeBB: 12 },
      ],
    };
    const info = computePotOdds(6, actionsByStreet, "flop", "BB")!;
    expect(info.callAmount).toBeCloseTo(8, 6);
  });

  it("credits the standard blind already posted preflop", () => {
    // BB facing a raise to 2.5 preflop only needs to add 1.5 (already has the 1BB blind in).
    const info = computePotOdds(1.5, { preflop: [{ position: "BTN", action: "raise", sizeBB: 2.5 }] }, "preflop", "BB")!;
    expect(info.callAmount).toBeCloseTo(1.5, 6);
  });

  it("returns null once hero has already matched the current bet level", () => {
    const actionsByStreet: Partial<Record<Street, ActionEvent[]>> = {
      flop: [
        { position: "BTN", action: "raise", sizeBB: 5 },
        { position: "BB", action: "call" },
      ],
    };
    expect(computePotOdds(6, actionsByStreet, "flop", "BB")).toBeNull();
  });

  it("identifies which opponent set the bet hero is facing", () => {
    const info = computePotOdds(6, { flop: [{ position: "CO", action: "raise", sizeBB: 6 }] }, "flop", "BB")!;
    expect(info.facingPosition).toBe("CO");
  });

  it("tracks the latest raiser as the facing position through multiple raises", () => {
    const actionsByStreet: Partial<Record<Street, ActionEvent[]>> = {
      flop: [
        { position: "CO", action: "raise", sizeBB: 4 },
        { position: "BTN", action: "raise", sizeBB: 12 },
      ],
    };
    const info = computePotOdds(6, actionsByStreet, "flop", "BB")!;
    expect(info.facingPosition).toBe("BTN");
  });
});
