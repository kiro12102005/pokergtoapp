import { ALL_HANDS } from "@/domain/cards/handNotation";
import { rankFromChar } from "@/domain/cards/card";
import { nearestStackBucket } from "@/engine/solver/abstraction";

/**
 * Chen formula - a standard, well-documented rough preflop hand-strength heuristic. Used only
 * to pick a *default villain range* ("top N% of hands") for equity-vs-range calculations; the
 * actual rigor comes from rangeEquity.ts's exact/Monte Carlo equity math, not from this score
 * being precise. Deliberately not using the app's own 169x169 Monte Carlo equity matrix here -
 * that file is precompute-only and pulling it into the client bundle just to rank hands would
 * add ~600KB for no real accuracy gain over this well-known closed-form heuristic.
 */
function highCardPoints(rank: number): number {
  if (rank === 14) return 10; // A
  if (rank === 13) return 8; // K
  if (rank === 12) return 7; // Q
  if (rank === 11) return 6; // J
  if (rank === 10) return 5; // T
  return rank / 2;
}

export function chenScore(hand: string): number {
  const isPair = hand.length === 2;
  const highRank = rankFromChar(hand[0]);
  const lowRank = rankFromChar(hand[1]);

  if (isPair) {
    return Math.max(5, highCardPoints(highRank) * 2);
  }

  const suited = hand.endsWith("s");
  let score = highCardPoints(highRank);
  if (suited) score += 2;

  const gap = highRank - lowRank - 1;
  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;

  // Straight bonus: connected (0 or 1 gap) cards both below a queen can make an open-ended
  // straight more easily.
  if (gap <= 1 && highRank < 12) score += 1;

  return score;
}

const HANDS_BY_STRENGTH_DESC = [...ALL_HANDS].sort((a, b) => chenScore(b) - chenScore(a));

/**
 * A default "villain range" - the top `topPercent` of starting hands by Chen score, weighted
 * by how many concrete combos each canonical hand represents (so e.g. "top 25%" means ~25% of
 * concrete 1326 starting combos, not 25% of the 169 canonical labels).
 */
export function defaultRangeHands(topPercentOfCombos: number): string[] {
  const clamped = Math.max(1, Math.min(100, topPercentOfCombos));
  const comboCountOf = (hand: string) => (hand.length === 2 ? 6 : hand.endsWith("s") ? 4 : 12);
  const totalCombos = HANDS_BY_STRENGTH_DESC.reduce((sum, h) => sum + comboCountOf(h), 0);
  const targetCombos = (totalCombos * clamped) / 100;

  const result: string[] = [];
  let seen = 0;
  for (const hand of HANDS_BY_STRENGTH_DESC) {
    if (seen >= targetCombos && result.length > 0) break;
    result.push(hand);
    seen += comboCountOf(hand);
  }
  return result;
}

/**
 * A club match's field shrinks and blinds rise over its course, so how wide players play
 * shifts across the same session - deep-stacked/early is tighter, short-stacked/late (and with
 * fewer players left) is much wider (Phase 1's own shove-only solver output confirms this:
 * e.g. 72o already shoves >50% of the time from UTG at 3BB). Centered on the ~30% average VPIP
 * reported for this player pool at a "typical" mid-depth stack (the 25BB bucket), scaled by
 * stack-depth bucket (same buckets the rest of the app uses - see abstraction.ts) and nudged
 * wider as fewer players remain at the table.
 */
const RANGE_PERCENT_BY_STACK_BUCKET: Record<number, number> = {
  100: 20,
  60: 23,
  40: 27,
  25: 30,
  15: 38,
  10: 45,
  7: 52,
  5: 58,
  3: 65,
};

const FULL_TABLE_SIZE = 6;
const SHORT_HANDED_WIDENING_PER_SEAT = 1.5;
const MAX_DEFAULT_RANGE_PERCENT = 70;

/**
 * The default range-width percentage for a given stack depth and how many players remain at
 * the table - see the module-level comment above for the reasoning. This is only ever a
 * starting-point assumption; the UI lets the user override it with a manually-selected range.
 */
export function defaultRangePercent(effectiveStackBB: number, playersRemaining: number = FULL_TABLE_SIZE): number {
  const bucket = nearestStackBucket(effectiveStackBB);
  const base = RANGE_PERCENT_BY_STACK_BUCKET[bucket] ?? 30;
  const shortHandedBonus = Math.max(0, FULL_TABLE_SIZE - playersRemaining) * SHORT_HANDED_WIDENING_PER_SEAT;
  return Math.min(MAX_DEFAULT_RANGE_PERCENT, base + shortHandedBonus);
}

/**
 * A rough playstyle-to-range-width mapping, for users who'd rather describe an opponent
 * qualitatively ("this guy is loose-aggressive") than pick a stack-depth-derived default or a
 * raw percentage by hand. Deliberately only varies width (via the same Chen-score ordering as
 * defaultRangeHands), not shape - a true LAG-vs-TAG range differs in which speculative hands it
 * includes (suited connectors, suited aces) at a given width, not just width, but modeling that
 * would require a second scoring dimension; width alone is a reasonable, honestly-labeled
 * approximation for this app's purposes.
 */
export type Playstyle = "nit" | "tag" | "lag" | "loose_passive";

export const PLAYSTYLE_LABEL_JA: Record<Playstyle, string> = {
  nit: "ナイト(タイト)",
  tag: "TAG(標準的)",
  lag: "LAG(ルースアグレッシブ)",
  loose_passive: "ルースパッシブ(何でもコール)",
};

const RANGE_PERCENT_BY_PLAYSTYLE: Record<Playstyle, number> = {
  nit: 12,
  tag: 22,
  lag: 42,
  loose_passive: 55,
};

export function rangePercentForPlaystyle(playstyle: Playstyle): number {
  return RANGE_PERCENT_BY_PLAYSTYLE[playstyle];
}
