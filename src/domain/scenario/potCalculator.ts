import { ActionEvent, Street } from "@/domain/scenario/scenarioState";
import { Position } from "@/domain/table/seats";

const STANDARD_BLINDS: Partial<Record<Position, number>> = { SB: 0.5, BB: 1 };
const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river"];

export interface StreetBettingState {
  /** Each position's total contribution so far this street (raise-to amounts, not deltas). */
  invested: Map<Position, number>;
  /** The current amount required to call, i.e. the largest bet/raise-to size so far. */
  betToLevel: number;
  /** Total newly-contributed this street, beyond whatever was already in the pot at its start. */
  total: number;
  /** Whoever most recently set the current bet-to level via a bet/raise/shove this street - i.e.
   *  whichever opponent hero is actually facing, when facing one. Null if nobody has bet/raised
   *  yet this street (checks/calls at the starting level only). */
  aggressor: Position | null;
}

/**
 * Replays one street's actions and returns the resulting betting state - each position's
 * contribution, the current bet-to level, and the total added to the pot. Shared by
 * computeCurrentPot() (only needs `total`) and potOdds.ts (needs `invested`/`betToLevel` for a
 * specific position to compute how much more they'd need to call). "raise"/"shove" sizeBB is a
 * raise-TO amount (see ActionEvent), so a call's amount isn't stored explicitly - it's derived
 * from the street's current bet-to level. Preflop starts with the standard blinds already
 * posted (the starting pot passed to computeCurrentPot already carries their BB-equivalent
 * value as dead money); postflop streets start at 0 with no forced bets.
 */
export function trackStreetBetting(street: Street, actions: ActionEvent[]): StreetBettingState {
  const invested = new Map<Position, number>(
    street === "preflop" ? (Object.entries(STANDARD_BLINDS) as [Position, number][]) : []
  );
  let betToLevel = street === "preflop" ? (STANDARD_BLINDS.BB ?? 0) : 0;
  let total = 0;
  let aggressor: Position | null = null;

  for (const action of actions) {
    const already = invested.get(action.position) ?? 0;
    if (action.action === "call") {
      const contribution = Math.max(0, betToLevel - already);
      total += contribution;
      invested.set(action.position, already + contribution);
    } else if (action.action === "raise" || action.action === "shove") {
      const to = action.sizeBB ?? betToLevel;
      total += Math.max(0, to - already);
      invested.set(action.position, to);
      betToLevel = Math.max(betToLevel, to);
      aggressor = action.position;
    }
    // fold/check contribute nothing.
  }
  return { invested, betToLevel, total, aggressor };
}

/**
 * The pot at the current decision point: the starting dead money (blinds + ante, entered once
 * by the user) plus every street's action-derived contribution up to and including `uptoStreet`.
 * This is what lets the pot stay auto-computed as the hand progresses across streets, instead
 * of being re-typed by hand at every street.
 */
export function computeCurrentPot(
  startingPotBB: number,
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>,
  uptoStreet: Street
): number {
  let pot = startingPotBB;
  for (const street of STREET_ORDER) {
    pot += trackStreetBetting(street, actionsByStreet[street] ?? []).total;
    if (street === uptoStreet) break;
  }
  return pot;
}
