import { icmEquity } from "@/engine/icm/icm";
import { CLUB_MATCH_POINTS_VECTOR } from "@/engine/icm/pointsVector";

/**
 * All preflop math in the solver is done in "BB units" (bb = 1), independent of the actual
 * chip counts in data/blindLevels.ts - see abstraction.ts for why (stack-depth-in-BB is the
 * strategically relevant axis, not raw chips).
 */
export interface TableStacksBB {
  /** Stacks for all 6 seats, in a fixed order, already net of this hand's blind/ante posting. */
  stacksBB: number[];
  /** Index into stacksBB for the two players actually contesting this pot. */
  heroIdx: number;
  villainIdx: number;
}

/**
 * ICM equity (against the club-match points vector) for a given 6-way stack distribution,
 * returning just the hero and villain's equity for convenience.
 */
export function heroVillainIcmEquity(
  table: TableStacksBB
): { hero: number; villain: number } {
  const equities = icmEquity(table.stacksBB, CLUB_MATCH_POINTS_VECTOR);
  return { hero: equities[table.heroIdx], villain: equities[table.villainIdx] };
}

/** Builds a stack array with hero/villain stacks replaced, other 4 seats held fixed. */
export function withHeroVillainStacks(
  base: TableStacksBB,
  heroStackBB: number,
  villainStackBB: number
): TableStacksBB {
  const stacksBB = [...base.stacksBB];
  stacksBB[base.heroIdx] = heroStackBB;
  stacksBB[base.villainIdx] = villainStackBB;
  return { stacksBB, heroIdx: base.heroIdx, villainIdx: base.villainIdx };
}

export interface AllInResolution {
  heroStackIfHeroWins: number;
  villainStackIfHeroWins: number;
  heroStackIfVillainWins: number;
  villainStackIfVillainWins: number;
}

/**
 * Resolves an all-in confrontation with side-pot-free "capped at-risk" accounting: if one
 * player's remaining stack is smaller, only that amount is at risk from both sides and any
 * excess is returned uncontested. This ignores true multi-way side pots (see Phase 1 plan's
 * documented simplification) but handles the common covering/covered case correctly.
 */
export function resolveAllIn(
  heroRemainingBB: number,
  villainRemainingBB: number,
  heroAlreadyInvestedBB: number,
  villainAlreadyInvestedBB: number,
  deadMoneyPotBB: number
): AllInResolution {
  const atRisk = Math.min(heroRemainingBB, villainRemainingBB);
  const contestedPot = deadMoneyPotBB + heroAlreadyInvestedBB + villainAlreadyInvestedBB + 2 * atRisk;
  const heroExcess = heroRemainingBB - atRisk;
  const villainExcess = villainRemainingBB - atRisk;

  return {
    heroStackIfHeroWins: heroExcess + contestedPot,
    villainStackIfHeroWins: villainExcess,
    heroStackIfVillainWins: heroExcess,
    villainStackIfVillainWins: villainExcess + contestedPot,
  };
}

/** Non-all-in terminal: pot is split by equity share ("cold equity" proxy, see Phase 1 plan). */
export function resolveShowdownProxy(
  heroInvestedBB: number,
  villainInvestedBB: number,
  deadMoneyPotBB: number,
  heroEquity: number
): { heroShare: number; villainShare: number } {
  const totalPot = deadMoneyPotBB + heroInvestedBB + villainInvestedBB;
  return {
    heroShare: -heroInvestedBB + heroEquity * totalPot,
    villainShare: -villainInvestedBB + (1 - heroEquity) * totalPot,
  };
}

/** Uncontested terminal: one player folds, the other wins everything invested so far. */
export function resolveFold(
  folderInvestedBB: number,
  winnerInvestedBB: number,
  deadMoneyPotBB: number
): { folderShare: number; winnerShare: number } {
  const totalPot = deadMoneyPotBB + folderInvestedBB + winnerInvestedBB;
  return {
    folderShare: -folderInvestedBB,
    winnerShare: -winnerInvestedBB + totalPot,
  };
}
