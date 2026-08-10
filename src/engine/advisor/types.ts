import { Card } from "@/domain/cards/card";
import { ActionEvent, StrategyMix, Street } from "@/domain/scenario/scenarioState";
import { Position } from "@/domain/table/seats";

/** One remaining player's stack, for ICM context. Table size is whatever the user has left -
 *  not fixed to 6-max, since players bust out over the course of a club match. */
export interface PlayerStack {
  position: Position;
  stackBB: number;
}

/**
 * The deterministic (non-LLM) "GTO baseline" for a call decision - required equity from pot
 * odds vs hero's actual computed equity against an assumed villain range. Computed in
 * analyzeStore.ts (see potOdds.ts / rangeEquity.ts) and passed through so the LLM's exploit
 * reasoning can react to real numbers instead of re-deriving (and likely misjudging) them.
 */
export interface GtoBaseline {
  requiredEquity: number;
  heroEquity: number;
  rangeDescription: string;
}

/**
 * A user-specified situation sent to an LLM advisor for an approximate strategy estimate.
 * Used both for postflop spots (always LLM-driven) and for preflop spots that fall outside
 * the exact precomputed solver table (see solverLookup.ts - the exact table is always tried
 * first for preflop, and only for the symmetric-stacks approximation it was solved under).
 * Unlike ScenarioState, this only needs enough structure to describe the spot in a prompt -
 * it isn't consumed by any solver math directly (though promptBuilder.ts runs the same
 * icmEquity() math Phase 1's solver uses to ground the prompt in real ICM numbers).
 */
export interface AdvisorSituation {
  street: Street;
  heroPosition: Position;
  effectiveStackBB: number;
  /** Pot at this decision point - the starting dead money plus every street's action-derived
   *  contribution up to and including `street` (see potCalculator.ts's computeCurrentPot). */
  potBB: number;
  board: Card[];
  heroCards: [Card, Card];
  /** The full hand's action history so far, keyed by street, so the advisor sees the whole
   *  story (e.g. hero raised preflop and c-bet the flop) rather than just the current street. */
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>;
  /**
   * Other players still in the hand/tournament (not hero), for ICM-aware analysis. Whenever
   * this is non-empty, the situation is routed through the LLM advisor even for preflop -
   * the precomputed exact table only covers a symmetric-stacks approximation and can't
   * reflect a real, uneven stack distribution.
   */
  otherPlayers?: PlayerStack[];
  /** Optional free-text notes appended to the prompt (e.g. villain tendencies). */
  extraContext?: string;
  /** The computed pot-odds-vs-equity baseline, when hero is facing a bet postflop - see
   *  GtoBaseline. Absent when not facing a bet (e.g. an opening check-or-bet decision). */
  gtoBaseline?: GtoBaseline;
  /**
   * Whether hero is responding to a wager someone already made on this street (true), or acting
   * with nobody having bet yet this street (false) - only meaningful/set postflop (see
   * potOdds.ts's facingPosition; preflop always omits this since the big blind already makes
   * every preflop decision a "raise" by standard convention). Drives whether the prompt should
   * ask for "bet" or "raise" terminology and sizing - see promptBuilder.ts.
   */
  facingBet?: boolean;
  /** What hero actually chose at this decision point, if known - lets the LLM's rationale
   *  directly address whether that choice agrees with the recommendation and why, instead of
   *  producing a recommendation blind to what the user did (see promptBuilder.ts). Absent for
   *  "what should hero do right now" situations where nothing has been chosen yet. */
  actualAction?: ActionEvent;
}

export interface AdvisorResult {
  provider: string;
  frequencies: StrategyMix;
  /** Suggested bet/raise-to size, as % of the pot immediately before the action - see
   *  schema.ts's sizePercentPot. Undefined when the model didn't suggest a raise/bet. */
  sizePercentPot?: number;
  rationale: string;
}

export class AdvisorError extends Error {}

export interface GtoResult extends GtoBaseline {
  callAmount: number;
  verdict: "call" | "fold" | "marginal";
}

/** One hero decision point's full result, as shown in the UI and saved to hand history - see
 *  analyzeStore.ts's submit() (which produces these) and handRecord.ts (which persists them). */
export interface AnalyzeResultDisplay {
  street: Street;
  /** What hero actually chose at this point in the entered history, if any - lets the user
   *  compare their actual play against the recommendation. Absent when this represents "what
   *  should hero do right now" rather than a review of an already-recorded choice. */
  actualAction?: ActionEvent;
  source: "exact" | "llm" | "error";
  frequencies?: StrategyMix;
  /** Suggested bet/raise-to size as % of the pot, when the LLM recommended one - see
   *  AdvisorResult.sizePercentPot. Only ever set for "llm" results. */
  sizePercentPot?: number;
  /** Whether this decision is facing an existing bet (raise/call/fold) or not (check/bet) -
   *  drives whether the UI should say "ベット" or "レイズ" for the aggressive action. Only set
   *  postflop (undefined for preflop, where "raise" is the standard term regardless). */
  facingBet?: boolean;
  rationale?: string;
  errorMessage?: string;
  /** The deterministic pot-odds-vs-equity baseline, when hero is facing a bet postflop. */
  gto?: GtoResult;
}
