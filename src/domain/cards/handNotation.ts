import { Card, Rank, SUITS, rankChar, rankFromChar } from "./card";

/** Ranks high-to-low, the order conventionally used to draw a 13x13 preflop range grid. */
const GRID_RANKS: Rank[] = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

export interface GridCell {
  /** Canonical hand code, e.g. "AA", "AKs", "AKo". */
  hand: string;
  row: number;
  col: number;
}

/**
 * Builds the 13x13 grid of canonical hand codes in the standard convention:
 * diagonal = pairs, upper-right triangle = suited, lower-left triangle = offsuit.
 */
export function buildHandGrid(): GridCell[][] {
  const grid: GridCell[][] = [];
  for (let row = 0; row < 13; row++) {
    const line: GridCell[] = [];
    for (let col = 0; col < 13; col++) {
      const high = GRID_RANKS[Math.min(row, col)];
      const low = GRID_RANKS[Math.max(row, col)];
      let hand: string;
      if (row === col) {
        hand = `${rankChar(high)}${rankChar(high)}`;
      } else if (row < col) {
        hand = `${rankChar(high)}${rankChar(low)}s`;
      } else {
        hand = `${rankChar(high)}${rankChar(low)}o`;
      }
      line.push({ hand, row, col });
    }
    grid.push(line);
  }
  return grid;
}

/** All 169 canonical starting hands, in grid (row-major) order. */
export const ALL_HANDS: string[] = buildHandGrid().flat().map((c) => c.hand);

export function isPair(hand: string): boolean {
  return hand.length === 2;
}

/** Enumerates the concrete card-pair combos represented by a canonical hand code. */
export function enumerateCombos(hand: string): [Card, Card][] {
  const combos: [Card, Card][] = [];
  if (isPair(hand)) {
    const rank = rankFromChar(hand[0]);
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        combos.push([
          { rank, suit: SUITS[i] },
          { rank, suit: SUITS[j] },
        ]);
      }
    }
    return combos;
  }

  const highRank = rankFromChar(hand[0]);
  const lowRank = rankFromChar(hand[1]);
  const suited = hand[2] === "s";

  if (suited) {
    for (const suit of SUITS) {
      combos.push([
        { rank: highRank, suit },
        { rank: lowRank, suit },
      ]);
    }
  } else {
    for (const suitHigh of SUITS) {
      for (const suitLow of SUITS) {
        if (suitHigh === suitLow) continue;
        combos.push([
          { rank: highRank, suit: suitHigh },
          { rank: lowRank, suit: suitLow },
        ]);
      }
    }
  }
  return combos;
}

/** Returns the canonical hand code (e.g. "AKs") for a concrete pair of cards. */
export function canonicalHandOf(c1: Card, c2: Card): string {
  const [hi, lo] = c1.rank >= c2.rank ? [c1, c2] : [c2, c1];
  if (hi.rank === lo.rank) {
    return `${rankChar(hi.rank)}${rankChar(hi.rank)}`;
  }
  const suited = hi.suit === lo.suit;
  return `${rankChar(hi.rank)}${rankChar(lo.rank)}${suited ? "s" : "o"}`;
}

/** Number of concrete combos represented by a canonical hand (6 for pairs, 4 suited, 12 offsuit). */
export function comboCount(hand: string): number {
  if (isPair(hand)) return 6;
  return hand.endsWith("s") ? 4 : 12;
}
