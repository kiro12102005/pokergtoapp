import { Card } from "@/domain/cards/card";

/**
 * 1=high card, 2=pair, 3=two pair, 4=trips, 5=straight, 6=flush, 7=full house, 8=quads, 9=straight flush
 */
const TIEBREAK_BASE = 15;
/** Exported so callers can recover the 1-9 hand category from an evaluate5()/evaluateBestHand() score. */
export const CATEGORY_MULTIPLIER = 1_000_000;

function encodeTiebreak(ranks: number[]): number {
  const padded = [...ranks, 0, 0, 0, 0, 0].slice(0, 5);
  return padded.reduce((acc, r) => acc * TIEBREAK_BASE + r, 0);
}

/** Evaluates exactly 5 cards; returns a score where higher always beats lower. */
export function evaluate5(cards: Card[]): number {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  const uniqueDesc = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;
  if (uniqueDesc.length === 5) {
    if (uniqueDesc[0] - uniqueDesc[4] === 4) {
      isStraight = true;
      straightHigh = uniqueDesc[0];
    } else if (
      uniqueDesc[0] === 14 &&
      uniqueDesc[1] === 5 &&
      uniqueDesc[2] === 4 &&
      uniqueDesc[3] === 3 &&
      uniqueDesc[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  const countByRank = new Map<number, number>();
  for (const r of ranks) countByRank.set(r, (countByRank.get(r) ?? 0) + 1);
  const groups = [...countByRank.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  if (isStraight && isFlush) {
    return CATEGORY_MULTIPLIER * 9 + encodeTiebreak([straightHigh]);
  }
  if (groups[0].count === 4) {
    return CATEGORY_MULTIPLIER * 8 + encodeTiebreak([groups[0].rank, groups[1].rank]);
  }
  if (groups[0].count === 3 && groups[1].count === 2) {
    return CATEGORY_MULTIPLIER * 7 + encodeTiebreak([groups[0].rank, groups[1].rank]);
  }
  if (isFlush) {
    return CATEGORY_MULTIPLIER * 6 + encodeTiebreak(ranks);
  }
  if (isStraight) {
    return CATEGORY_MULTIPLIER * 5 + encodeTiebreak([straightHigh]);
  }
  if (groups[0].count === 3) {
    const kickers = groups.slice(1).map((g) => g.rank);
    return CATEGORY_MULTIPLIER * 4 + encodeTiebreak([groups[0].rank, ...kickers]);
  }
  if (groups[0].count === 2 && groups[1].count === 2) {
    const [hi, lo] = [groups[0].rank, groups[1].rank].sort((a, b) => b - a);
    return CATEGORY_MULTIPLIER * 3 + encodeTiebreak([hi, lo, groups[2].rank]);
  }
  if (groups[0].count === 2) {
    const kickers = groups.slice(1).map((g) => g.rank);
    return CATEGORY_MULTIPLIER * 2 + encodeTiebreak([groups[0].rank, ...kickers]);
  }
  return CATEGORY_MULTIPLIER * 1 + encodeTiebreak(ranks);
}
