import { describe, it, expect } from "vitest";
import { parseHandHistory, HandHistoryParseError } from "@/engine/import/handHistoryParser";
import { cardToString } from "@/domain/cards/card";

const CASH_HAND = `PokerStars Hand #123456789: Hold'em No Limit ($0.50/$1.00 USD) - 2026/01/01 12:00:00 ET
Table 'Example' 6-max Seat #4 is the button
Seat 1: Player1 ($100 in chips)
Seat 2: Player2 ($100 in chips)
Seat 3: Player3 ($100 in chips)
Seat 4: Hero ($100 in chips)
Seat 5: Player5 ($100 in chips)
Seat 6: Player6 ($100 in chips)
Player5: posts small blind $0.50
Player6: posts big blind $1
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
Player1: folds
Player2: folds
Player3: folds
Hero: raises $2 to $3
Player5: folds
Player6: calls $2
*** FLOP *** [2h 7c Jd]
Player6: checks
Hero: bets $4
Player6: calls $4
*** TURN *** [2h 7c Jd] [3s]
Player6: checks
Hero: bets $10
Player6: folds
Uncalled bet ($10) returned to Hero
Hero collected $15.50 from pot
*** SUMMARY ***
Total pot $15.50 | Rake $0
Board [2h 7c Jd 3s]
Seat 1: Player1 folded before Flop (didn't bet)
Seat 4: Hero (button) collected ($15.50)
`;

const TOURNAMENT_FOLD_HAND = `PokerStars Hand #987654321: Tournament #111222333, $10+$1 USD Hold'em No Limit - Level V (75/150) - 2026/01/02 18:00:00 ET
Table '111222333 1' 6-max Seat #1 is the button
Seat 1: PlayerA (3000 in chips)
Seat 2: PlayerB (2500 in chips)
Seat 3: PlayerC (4000 in chips)
Seat 4: PlayerD (1800 in chips)
Seat 5: Hero (5000 in chips)
Seat 6: PlayerF (2200 in chips)
PlayerA: posts the ante 15
PlayerB: posts the ante 15
PlayerC: posts the ante 15
PlayerD: posts the ante 15
Hero: posts the ante 15
PlayerF: posts the ante 15
PlayerB: posts small blind 75
PlayerC: posts big blind 150
*** HOLE CARDS ***
Dealt to Hero [2c 7d]
PlayerD: folds
Hero: folds
PlayerF: folds
PlayerA: raises 300 to 450
PlayerB: folds
PlayerC: folds
Uncalled bet (300) returned to PlayerA
PlayerA collected 615 from pot
*** SUMMARY ***
`;

const ALL_IN_HAND = `PokerStars Hand #111: Hold'em No Limit ($0.50/$1.00 USD) - 2026/01/01 12:00:00 ET
Table 'Shove' 6-max Seat #1 is the button
Seat 1: Player1 ($100 in chips)
Seat 2: Player2 ($100 in chips)
Seat 3: Player3 ($100 in chips)
Seat 4: Player4 ($20 in chips)
Seat 5: Player5 ($100 in chips)
Seat 6: Hero ($100 in chips)
Player2: posts small blind $0.50
Player3: posts big blind $1
*** HOLE CARDS ***
Dealt to Hero [7c 2d]
Player4: raises $19 to $20 and is all-in
Player5: folds
Hero: folds
Player1: folds
Player2: folds
Player3: folds
Uncalled bet ($19) returned to Player4
*** SUMMARY ***
`;

describe("parseHandHistory", () => {
  it("parses the header, hero position, and hero cards", () => {
    const snapshot = parseHandHistory(CASH_HAND);

    expect(snapshot.format).toBe("cash");
    expect(snapshot.heroPosition).toBe("BTN");
    expect(snapshot.heroCards.map(cardToString)).toEqual(["Ah", "Kd"]);
  });

  it("assigns positions from the button and matches the hand text's own blind labels", () => {
    const snapshot = parseHandHistory(CASH_HAND);
    // Player5 posted SB and Player6 posted BB in the raw text - the button-relative seat mapping
    // must reproduce that independently, since nothing in the parser reads those "posts" lines
    // for position assignment.
    expect(snapshot.otherPlayers.find((p) => p.position === "SB")).toBeTruthy();
    expect(snapshot.otherPlayers.find((p) => p.position === "BB")).toBeTruthy();
  });

  it("stops the resolved street's actions right before hero's own action", () => {
    const snapshot = parseHandHistory(CASH_HAND);
    // Hero (BTN) bet the turn - that's hero's last decision in the hand, so street should be
    // "turn" and the turn's action list should contain only what happened before hero's bet
    // (BB's check), not hero's bet itself or BB's subsequent fold.
    expect(snapshot.street).toBe("turn");
    expect(snapshot.actionsByStreet.turn).toEqual([{ position: "BB", action: "check" }]);
    // Earlier streets (fully resolved history) keep every action, hero's included.
    expect(snapshot.actionsByStreet.preflop).toEqual([
      { position: "UTG", action: "fold" },
      { position: "HJ", action: "fold" },
      { position: "CO", action: "fold" },
      { position: "BTN", action: "raise", sizeBB: 3 },
      { position: "SB", action: "fold" },
      { position: "BB", action: "call" },
    ]);
    expect(snapshot.actionsByStreet.flop).toEqual([
      { position: "BB", action: "check" },
      { position: "BTN", action: "raise", sizeBB: 4 },
      { position: "BB", action: "call" },
    ]);
  });

  it("computes the pot hero actually faced, not the pot after hero's own bet", () => {
    const snapshot = parseHandHistory(CASH_HAND);
    // 0.5 (SB) + 1 (BB) dead money, + 3 (BTN preflop raise-to) + 2 (BB call-up) preflop,
    // + 4 (BTN flop bet) + 4 (BB flop call), + 0 on the turn (only a check before hero's bet).
    expect(snapshot.potBB).toBeCloseTo(14.5);
  });

  it("truncates the board to the resolved street even if later streets appear in the text", () => {
    const snapshot = parseHandHistory(CASH_HAND);
    expect(snapshot.board.map(cardToString)).toEqual(["2h", "7c", "Jd", "3s"]);
  });

  it("drops hero's own fold from the truncated street, leaving only what preceded it", () => {
    const snapshot = parseHandHistory(TOURNAMENT_FOLD_HAND);
    expect(snapshot.format).toBe("tournament");
    expect(snapshot.heroPosition).toBe("HJ");
    expect(snapshot.street).toBe("preflop");
    expect(snapshot.actionsByStreet.preflop).toEqual([{ position: "UTG", action: "fold" }]);
    expect(snapshot.board).toEqual([]);
  });

  it("includes ante + blinds as dead money for a tournament hand", () => {
    const snapshot = parseHandHistory(TOURNAMENT_FOLD_HAND);
    // 0.5 + 1 (blinds) + 6 * (15/150) ante = 1.5 + 0.6 = 2.1
    expect(snapshot.startingPotBB).toBeCloseTo(2.1);
    expect(snapshot.potBB).toBeCloseTo(2.1); // UTG's fold added no money
  });

  it("uses the smallest stack among hero and villains as the effective stack", () => {
    const snapshot = parseHandHistory(TOURNAMENT_FOLD_HAND);
    // PlayerD had the shortest stack (1800), 1800/150 = 12 BB.
    expect(snapshot.effectiveStackBB).toBeCloseTo(12);
  });

  it("parses an explicit all-in raise as a shove, distinct from a plain raise", () => {
    const snapshot = parseHandHistory(ALL_IN_HAND);
    expect(snapshot.heroPosition).toBe("CO");
    expect(snapshot.street).toBe("preflop");
    // Hero's own fold (and everything after it) is truncated away, but UTG's earlier all-in
    // shove and HJ's fold survive since they came before hero's decision.
    expect(snapshot.actionsByStreet.preflop).toEqual([
      { position: "UTG", action: "shove", sizeBB: 20 },
      { position: "HJ", action: "fold" },
    ]);
    expect(snapshot.potBB).toBeCloseTo(21.5);
  });

  it("rejects a table that isn't exactly 6-max", () => {
    const fiveMax = CASH_HAND.replace("Seat 6: Player6 ($100 in chips)\n", "").replace(
      "Player6: posts big blind $1",
      "Player3: posts big blind $1"
    );
    expect(() => parseHandHistory(fiveMax)).toThrow(HandHistoryParseError);
  });

  it("rejects empty input", () => {
    expect(() => parseHandHistory("   ")).toThrow(HandHistoryParseError);
  });

  it("rejects text with no recognizable hand history", () => {
    expect(() => parseHandHistory("this is not a hand history")).toThrow(HandHistoryParseError);
  });
});
