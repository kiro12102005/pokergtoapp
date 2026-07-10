import { ALL_HANDS, comboCount } from "@/domain/cards/handNotation";
import { icmEquity } from "@/engine/icm/icm";
import { CLUB_MATCH_POINTS_VECTOR } from "@/engine/icm/pointsVector";
import { EquityMatrix, equityVsRangeFromMatrix } from "@/engine/equity/equityMatrix";
import {
  TableStacksBB,
  resolveAllIn,
  withHeroVillainStacks,
} from "./gameTree";

const TOTAL_COMBOS = 1326; // C(52,2)

export interface PushFoldResult {
  /** heroPosition's shove-or-fold range: hand -> 1 (shove) | 0 (fold). */
  shoveRange: Map<string, number>;
  /** representative next-to-act position's facing-shove call-or-fold range. */
  callRange: Map<string, number>;
}

function rangeCallFraction(range: Map<string, number>): number {
  let weighted = 0;
  for (const hand of ALL_HANDS) {
    weighted += (range.get(hand) ?? 0) * comboCount(hand);
  }
  return weighted / TOTAL_COMBOS;
}

function seedRangeByStrength(matrix: EquityMatrix, topFraction: number): Map<string, number> {
  const uniformRange = new Map<string, number>(ALL_HANDS.map((h) => [h, 1]));
  const ranked = [...ALL_HANDS].sort(
    (a, b) =>
      equityVsRangeFromMatrix(b, uniformRange, matrix) -
      equityVsRangeFromMatrix(a, uniformRange, matrix)
  );
  const cutoff = Math.round(ranked.length * topFraction);
  const range = new Map<string, number>();
  ranked.forEach((hand, i) => range.set(hand, i < cutoff ? 1 : 0));
  return range;
}

/**
 * Solves the "hero shoves or folds, one representative next-position opponent calls or
 * folds" ICM Nash equilibrium via alternating best-response fixed-point iteration. Ignores
 * players further behind the representative caller (see Phase 1 plan's documented
 * simplification: multiway jam/fold Nash is reduced to a heads-up-equivalent vs the next
 * player to act, while the actual ICM payoff still uses the full 6-player stack array).
 *
 * `opponentsBehindCount` corrects hero's fold-equity estimate for the fact that ANY of the
 * players still to act could call, not just the single representative one: treating each of
 * them as an independent draw from the representative calling range, P(at least one calls) =
 * 1-(1-pCallSingle)^opponentsBehindCount. Without this correction, hero's shove range comes
 * out unrealistically wide (approaching 100% of hands) because a single opponent's ~5-10%
 * combo-weighted calling range makes shoving look almost always uncontested.
 */
export function solvePushFoldUnopened(
  table: TableStacksBB,
  deadMoneyPotBB: number,
  equityMatrix: EquityMatrix,
  opponentsBehindCount = 1,
  iterations = 12
): PushFoldResult {
  const heroStackBB = table.stacksBB[table.heroIdx];
  const villainStackBB = table.stacksBB[table.villainIdx];

  const evFoldHero = icmEquity(table.stacksBB, CLUB_MATCH_POINTS_VECTOR)[table.heroIdx];
  const evFoldVillain = icmEquity(table.stacksBB, CLUB_MATCH_POINTS_VECTOR)[table.villainIdx];

  const allIn = resolveAllIn(heroStackBB, villainStackBB, 0, 0, deadMoneyPotBB);
  const stacksIfHeroWinsAllIn = withHeroVillainStacks(
    table,
    allIn.heroStackIfHeroWins,
    allIn.villainStackIfHeroWins
  ).stacksBB;
  const stacksIfVillainWinsAllIn = withHeroVillainStacks(
    table,
    allIn.heroStackIfVillainWins,
    allIn.villainStackIfVillainWins
  ).stacksBB;
  const icmIfHeroWinsAllIn = icmEquity(stacksIfHeroWinsAllIn, CLUB_MATCH_POINTS_VECTOR);
  const icmIfVillainWinsAllIn = icmEquity(stacksIfVillainWinsAllIn, CLUB_MATCH_POINTS_VECTOR);

  const stacksIfUncontested = withHeroVillainStacks(
    table,
    heroStackBB + deadMoneyPotBB,
    villainStackBB
  ).stacksBB;
  const evUncontestedHero = icmEquity(stacksIfUncontested, CLUB_MATCH_POINTS_VECTOR)[table.heroIdx];

  // Fictitious play: best-respond to the opponent's AVERAGE range-so-far (not their last pure
  // move) and fold that response into a running average. Plain alternating best response
  // (always best-responding to the opponent's last pure move) oscillates in a 2-cycle for
  // this game rather than converging - averaging is the standard fix and, as a side benefit,
  // produces non-degenerate mixed frequencies near indifference points instead of a hard 0/1
  // flip.
  let shoveRange = seedRangeByStrength(equityMatrix, 0.25);
  let callRange = seedRangeByStrength(equityMatrix, 0.15);

  for (let iter = 0; iter < iterations; iter++) {
    const sampleCount = iter + 2; // seed counts as one prior sample

    const pCallSingle = rangeCallFraction(callRange);
    const pCallEffective = 1 - Math.pow(1 - pCallSingle, opponentsBehindCount);
    const pFold = 1 - pCallEffective;

    const newShoveRange = new Map<string, number>();
    for (const hand of ALL_HANDS) {
      const equityVsCallRange = equityVsRangeFromMatrix(hand, callRange, equityMatrix);
      const evShove =
        pFold * evUncontestedHero +
        pCallEffective *
          (equityVsCallRange * icmIfHeroWinsAllIn[table.heroIdx] +
            (1 - equityVsCallRange) * icmIfVillainWinsAllIn[table.heroIdx]);
      const bestResponse = evShove > evFoldHero ? 1 : 0;
      const prevAvg = shoveRange.get(hand) ?? 0;
      newShoveRange.set(hand, prevAvg + (bestResponse - prevAvg) / sampleCount);
    }
    shoveRange = newShoveRange;

    const newCallRange = new Map<string, number>();
    for (const hand of ALL_HANDS) {
      const equityVsShoveRange = equityVsRangeFromMatrix(hand, shoveRange, equityMatrix);
      const evCall =
        equityVsShoveRange * icmIfVillainWinsAllIn[table.villainIdx] +
        (1 - equityVsShoveRange) * icmIfHeroWinsAllIn[table.villainIdx];
      const bestResponse = evCall > evFoldVillain ? 1 : 0;
      const prevAvg = callRange.get(hand) ?? 0;
      newCallRange.set(hand, prevAvg + (bestResponse - prevAvg) / sampleCount);
    }
    callRange = newCallRange;
  }

  return { shoveRange, callRange };
}
