import { computeCurrentPot, trackStreetBetting } from "./potCalculator";
import { ActionEvent, Street } from "./scenarioState";
import { Position } from "@/domain/table/seats";

export interface PotOddsInfo {
  /** How much more hero must put in to call the current bet on this street. */
  callAmount: number;
  /** Pot size before hero's call (everything contributed so far, including hero's own
   *  investment already made this street). */
  potBeforeCall: number;
  /** Equity hero needs to break even on a call: callAmount / (potBeforeCall + callAmount). */
  requiredEquity: number;
  /** Whoever set the bet hero is facing - lets the caller look up that specific opponent's
   *  configured range instead of one generic "the villain" assumption. Null in the (rare, since
   *  callAmount > 0 here) case the aggressor can't be identified. */
  facingPosition: Position | null;
}

/**
 * The "required equity" half of the GTO pot-odds-vs-equity comparison (see rangeEquity.ts for
 * the "actual equity" half). Returns null when hero isn't actually facing a bet on this street
 * (e.g. first to act, or everyone before them checked) - pot odds framing doesn't apply to an
 * opening decision.
 */
export function computePotOdds(
  startingPotBB: number,
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>,
  street: Street,
  heroPosition: Position
): PotOddsInfo | null {
  const { invested, betToLevel, aggressor } = trackStreetBetting(street, actionsByStreet[street] ?? []);
  const heroInvested = invested.get(heroPosition) ?? 0;
  const callAmount = betToLevel - heroInvested;
  if (callAmount <= 0) return null;

  const potBeforeCall = computeCurrentPot(startingPotBB, actionsByStreet, street);
  return {
    callAmount,
    potBeforeCall,
    requiredEquity: callAmount / (potBeforeCall + callAmount),
    facingPosition: aggressor,
  };
}
