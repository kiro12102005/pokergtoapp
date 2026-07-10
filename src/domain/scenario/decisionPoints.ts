import { ActionEvent, Street } from "@/domain/scenario/scenarioState";
import { trackStreetBetting } from "@/domain/scenario/potCalculator";
import { Position } from "@/domain/table/seats";

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river"];

export interface HeroDecisionPoint {
  street: Street;
  /** What hero actually chose at this point in the entered history, so results can be shown
   *  next to what really happened. Absent for the "what should hero do right now" case, where
   *  hero hasn't acted yet anywhere in the entered history. */
  actualAction?: ActionEvent;
  /** The action history strictly *before* this decision - prior streets in full, this street
   *  truncated to just before the decision (or as-is for the "pending decision" case). */
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>;
}

/**
 * Finds every point where hero acted within actionsByStreet (up to and including uptoStreet).
 * The user builds one continuous action list per street, which may include hero's own choices
 * (recording what actually happened) - each such choice is a separate decision that deserves
 * its own recommendation, not just one verdict for the whole entered hand (e.g. hero checking
 * then later calling a raise on the same street are two different decisions).
 *
 * Whenever hero has an unanswered decision pending on `uptoStreet`, an extra entry representing
 * "what should hero do right now" is appended, using the full history up to uptoStreet as-is.
 * "Pending" covers three cases: hero hasn't acted at all yet anywhere (original case); hero
 * already played earlier streets and just advanced to a new, still-empty street (e.g. hero
 * called a flop bet, moved to the turn, and hasn't recorded a turn action yet - without this,
 * that silently produced no recommendation at all for the turn); and hero already acted once
 * this street but a later opponent action reopened it (e.g. hero checked, villain bet, and hero
 * hasn't decided how to respond yet - reusing potCalculator.ts's trackStreetBetting to tell
 * "reopened" apart from "closed", since a naive "last action isn't hero's" check would also
 * misfire when an opponent's own *call* simply closes the street after hero's raise).
 */
export function findHeroDecisionPoints(
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>,
  heroPosition: Position,
  uptoStreet: Street
): HeroDecisionPoint[] {
  const priorStreets: Partial<Record<Street, ActionEvent[]>> = {};
  const points: HeroDecisionPoint[] = [];

  for (const street of STREET_ORDER) {
    const actions = actionsByStreet[street] ?? [];
    actions.forEach((event, index) => {
      if (event.position === heroPosition) {
        points.push({
          street,
          actualAction: event,
          actionsByStreet: { ...priorStreets, [street]: actions.slice(0, index) },
        });
      }
    });
    priorStreets[street] = actions;
    if (street === uptoStreet) break;
  }

  const uptoStreetActions = actionsByStreet[uptoStreet] ?? [];
  const heroActedThisStreet = uptoStreetActions.some((e) => e.position === heroPosition);
  const heroHasPendingDecision = heroActedThisStreet
    ? (() => {
        const { invested, betToLevel } = trackStreetBetting(uptoStreet, uptoStreetActions);
        return (invested.get(heroPosition) ?? 0) < betToLevel;
      })()
    : true;
  if (heroHasPendingDecision) {
    points.push({ street: uptoStreet, actionsByStreet: priorStreets });
  }

  return points;
}
