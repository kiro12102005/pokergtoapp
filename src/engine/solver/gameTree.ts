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
 * A stack distribution -> per-player EV function, injected into the solvers (see
 * pushFoldSolver.ts / cfrSolver.ts) so the same alternating-best-response code solves both game
 * formats: tournament passes `(stacks) => icmEquity(stacks, CLUB_MATCH_POINTS_VECTOR)` (ICM,
 * finish-position-points EV), cash passes the identity function `(stacks) => stacks` (pure chip
 * EV - in a cash game a player's utility *is* their expected chip count, so no ICM computation
 * is needed at all, not even with a linear payout vector). See scripts/precompute-preflop.ts for
 * where each format's function is constructed.
 */
export type StackEvaluator = (stacksBB: number[]) => number[];

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
 *
 * `rakePercent` (cash games only, default 0) is taken off the *contested* pot before splitting
 * to the winner - matching the standard "no flop, no drop" cash-game convention: an uncontested
 * fold (see the inline uncontested-EV calculations in pushFoldSolver.ts / cfrSolver.ts, which
 * never call this function) is never raked, only a pot that's actually fought over is. Tournament
 * solves always pass 0 (a club match's "rake" is the buy-in, already sunk before the hand starts,
 * so it doesn't affect in-hand EV).
 */
export function resolveAllIn(
  heroRemainingBB: number,
  villainRemainingBB: number,
  heroAlreadyInvestedBB: number,
  villainAlreadyInvestedBB: number,
  deadMoneyPotBB: number,
  rakePercent = 0
): AllInResolution {
  const atRisk = Math.min(heroRemainingBB, villainRemainingBB);
  const contestedPot = deadMoneyPotBB + heroAlreadyInvestedBB + villainAlreadyInvestedBB + 2 * atRisk;
  const rakedPot = contestedPot * (1 - rakePercent);
  const heroExcess = heroRemainingBB - atRisk;
  const villainExcess = villainRemainingBB - atRisk;

  return {
    heroStackIfHeroWins: heroExcess + rakedPot,
    villainStackIfHeroWins: villainExcess,
    heroStackIfVillainWins: heroExcess,
    villainStackIfVillainWins: villainExcess + rakedPot,
  };
}

/** Non-all-in terminal: pot is split by equity share ("cold equity" proxy, see Phase 1 plan).
 *  `rakePercent` - see resolveAllIn's doc; same "rake the contested pot only" treatment. */
export function resolveShowdownProxy(
  heroInvestedBB: number,
  villainInvestedBB: number,
  deadMoneyPotBB: number,
  heroEquity: number,
  rakePercent = 0
): { heroShare: number; villainShare: number } {
  const totalPot = deadMoneyPotBB + heroInvestedBB + villainInvestedBB;
  const rakedPot = totalPot * (1 - rakePercent);
  return {
    heroShare: -heroInvestedBB + heroEquity * rakedPot,
    villainShare: -villainInvestedBB + (1 - heroEquity) * rakedPot,
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
