/** 6-max seat positions. */
export type Position = "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB";

/** Preflop action order: first to act ... last to act. */
export const PREFLOP_ACTION_ORDER: Position[] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];

/** Table seating order (for drawing the seat ring), starting from BTN going clockwise. */
export const SEAT_RING_ORDER: Position[] = ["BTN", "SB", "BB", "UTG", "HJ", "CO"];

export function positionIndex(position: Position): number {
  return PREFLOP_ACTION_ORDER.indexOf(position);
}

/** Positions that still have not acted this street, in order, starting after `position`. */
export function positionsAfter(position: Position): Position[] {
  const idx = positionIndex(position);
  return PREFLOP_ACTION_ORDER.slice(idx + 1);
}

/** Positions that acted before `position` this street (unopened pot = none). */
export function positionsBefore(position: Position): Position[] {
  const idx = positionIndex(position);
  return PREFLOP_ACTION_ORDER.slice(0, idx);
}

export function isInPositionVs(a: Position, b: Position): boolean {
  return positionIndex(a) > positionIndex(b);
}
