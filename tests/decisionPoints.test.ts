import { describe, it, expect } from "vitest";
import { findHeroDecisionPoints } from "@/domain/scenario/decisionPoints";
import { ActionEvent, Street } from "@/domain/scenario/scenarioState";

const actionsByStreet = {
  preflop: [
    { position: "BTN", action: "raise", sizeBB: 2.5 },
    { position: "SB", action: "call" },
  ],
  flop: [
    { position: "SB", action: "check" },
    { position: "BTN", action: "raise", sizeBB: 4 },
    { position: "SB", action: "call" },
  ],
} satisfies Partial<Record<Street, ActionEvent[]>>;

describe("findHeroDecisionPoints", () => {
  it("returns a single pending-decision entry when hero has no actions yet", () => {
    const points = findHeroDecisionPoints({ preflop: [{ position: "BTN", action: "raise", sizeBB: 2.5 }] }, "SB", "preflop");
    expect(points).toHaveLength(1);
    expect(points[0].actualAction).toBeUndefined();
    expect(points[0].street).toBe("preflop");
    expect(points[0].actionsByStreet.preflop).toEqual([{ position: "BTN", action: "raise", sizeBB: 2.5 }]);
  });

  it("finds every hero action up to and including the current street", () => {
    // hero is SB: acted preflop (call) and twice on the flop (check, then call) - 3 decisions.
    const points = findHeroDecisionPoints(actionsByStreet, "SB", "flop");
    expect(points).toHaveLength(3);
    expect(points.map((p) => p.street)).toEqual(["preflop", "flop", "flop"]);
    expect(points.map((p) => p.actualAction?.action)).toEqual(["call", "check", "call"]);
  });

  it("each decision point's history excludes the hero action itself and everything after", () => {
    const points = findHeroDecisionPoints(actionsByStreet, "SB", "flop");
    // SB's flop check (1st flop decision): history before it is empty on the flop.
    expect(points[1].actionsByStreet.flop).toEqual([]);
    // SB's flop call facing BTN's raise (2nd flop decision): history is SB check + BTN raise.
    expect(points[2].actionsByStreet.flop).toEqual([
      { position: "SB", action: "check" },
      { position: "BTN", action: "raise", sizeBB: 4 },
    ]);
    // Prior street (preflop) is carried forward in full for both flop decisions.
    expect(points[1].actionsByStreet.preflop).toEqual(actionsByStreet.preflop);
    expect(points[2].actionsByStreet.preflop).toEqual(actionsByStreet.preflop);
  });

  it("does not look at streets after uptoStreet", () => {
    const points = findHeroDecisionPoints(actionsByStreet, "SB", "preflop");
    expect(points).toHaveLength(1);
    expect(points[0].street).toBe("preflop");
    expect(points[0].actionsByStreet.flop).toBeUndefined();
  });

  it("ignores non-hero positions", () => {
    const points = findHeroDecisionPoints(actionsByStreet, "BTN", "flop");
    expect(points.map((p) => p.street)).toEqual(["preflop", "flop"]);
    expect(points.every((p) => p.actualAction?.position === "BTN")).toBe(true);
  });

  it("adds a pending decision for a fresh street after hero already acted on earlier streets", () => {
    // Hero called a flop bet, then advanced to the turn without recording any turn action yet -
    // this used to silently produce nothing for the turn (the reported bug).
    const points = findHeroDecisionPoints(actionsByStreet, "SB", "turn");
    expect(points).toHaveLength(4); // the 3 earlier decisions plus the new pending turn entry.
    const turnPoint = points[points.length - 1];
    expect(turnPoint.street).toBe("turn");
    expect(turnPoint.actualAction).toBeUndefined();
    expect(turnPoint.actionsByStreet.flop).toEqual(actionsByStreet.flop);
  });

  it("adds a pending decision when hero already acted this street but an opponent reopened it", () => {
    // Hero checked the flop, then BTN bet - hero hasn't responded to that bet yet.
    const reopened = {
      preflop: actionsByStreet.preflop,
      flop: [
        { position: "SB", action: "check" },
        { position: "BTN", action: "raise", sizeBB: 4 },
      ],
    } satisfies Partial<Record<Street, ActionEvent[]>>;
    const points = findHeroDecisionPoints(reopened, "SB", "flop");
    const lastPoint = points[points.length - 1];
    expect(lastPoint.actualAction).toBeUndefined();
    expect(lastPoint.actionsByStreet.flop).toEqual(reopened.flop);
  });

  it("does not add a redundant pending decision when hero's own action already closed the street", () => {
    // Covered by the main "finds every hero action" case too, but assert it explicitly here:
    // SB's flop call matches BTN's bet, so nothing is pending for SB after that.
    const points = findHeroDecisionPoints(actionsByStreet, "SB", "flop");
    const lastPoint = points[points.length - 1];
    expect(lastPoint.actualAction?.action).toBe("call");
  });
});
