import { ALL_HANDS, comboCount } from "@/domain/cards/handNotation";
import { icmEquity } from "@/engine/icm/icm";
import { CLUB_MATCH_POINTS_VECTOR } from "@/engine/icm/pointsVector";
import { EquityMatrix, equityVsRangeFromMatrix } from "@/engine/equity/equityMatrix";
import { StrategyMix } from "@/domain/scenario/scenarioState";
import {
  TableStacksBB,
  resolveAllIn,
  resolveShowdownProxy,
  withHeroVillainStacks,
} from "./gameTree";

/**
 * Solves the deep-stack (non-shove-only) preflop tree - open/fold, facing-open
 * fold/call/3bet, facing-3bet fold/call/shove, facing-4bet(shove) fold/call - via alternating
 * best-response iteration, deepest-node-first each pass (see design notes in this file's
 * accompanying plan doc). This is a pragmatic substitute for textbook regret-matching CFR+:
 * given the tiny 2-player abstracted tree, iterated best response converges to a comparable
 * approximate equilibrium with much simpler code, at the cost of CFR+'s formal convergence
 * guarantees. Terminal "sees a flop" values use cold preflop equity as a proxy for postflop
 * play (postflop itself is out of Phase 1's scope - see the plan's documented simplification).
 */

const SOFTMAX_TEMPERATURE = 0.03;

function softmax(evs: Record<string, number>): StrategyMix {
  const keys = Object.keys(evs);
  const max = Math.max(...keys.map((k) => evs[k]));
  const exps = keys.map((k) => Math.exp((evs[k] - max) / SOFTMAX_TEMPERATURE));
  const sum = exps.reduce((a, b) => a + b, 0);
  const result: StrategyMix = {};
  keys.forEach((k, i) => {
    (result as Record<string, number>)[k] = exps[i] / sum;
  });
  return result;
}

/**
 * Fictitious play averaging: blends a fresh best-response softmax into the running average
 * strategy for a hand, rather than overwriting it. Plain alternating best response oscillates
 * for this game instead of converging (verified empirically - see pushFoldSolver.ts's docs
 * for the same fix in the shove/fold solver); averaging is the standard remedy.
 */
function blendStrategy(prev: StrategyMix, fresh: StrategyMix, sampleCount: number): StrategyMix {
  const keys = new Set([...Object.keys(prev), ...Object.keys(fresh)]);
  const blended: StrategyMix = {};
  for (const key of keys) {
    const k = key as keyof StrategyMix;
    const prevValue = prev[k] ?? 0;
    const freshValue = fresh[k] ?? 0;
    (blended as Record<string, number>)[k] = prevValue + (freshValue - prevValue) / sampleCount;
  }
  return blended;
}

function rangeFromStrategyAction(
  strategy: Map<string, StrategyMix>,
  action: keyof StrategyMix
): Map<string, number> {
  const range = new Map<string, number>();
  for (const hand of ALL_HANDS) {
    range.set(hand, strategy.get(hand)?.[action] ?? 0);
  }
  return range;
}

function seedUniformStrategy(actions: (keyof StrategyMix)[]): Map<string, StrategyMix> {
  const strategy = new Map<string, StrategyMix>();
  const p = 1 / actions.length;
  for (const hand of ALL_HANDS) {
    const mix: StrategyMix = {};
    for (const a of actions) (mix as Record<string, number>)[a] = p;
    strategy.set(hand, mix);
  }
  return strategy;
}

export interface DeepStackResult {
  rfi: Map<string, StrategyMix>;
  vsOpen: Map<string, StrategyMix>;
  vs3bet: Map<string, StrategyMix>;
  vs4bet: Map<string, StrategyMix>;
}

export interface DeepStackConfig {
  table: TableStacksBB;
  deadMoneyPotBB: number;
  openSizeBB: number;
  threeBetSizeBB: number;
  equityMatrix: EquityMatrix;
  /**
   * Number of players still to act behind hero when hero opens (e.g. 5 for UTG, 2 for BTN).
   * Only the immediate next position is modeled as an explicit opponent (see this file's
   * top-of-file docs), but hero's fold-equity at the "rfi" node is corrected for the fact
   * that ANY of them could continue, not just the single represented one: P(everyone folds) =
   * P(single opponent folds)^opponentsBehindCount. Without this, the open-or-fold decision
   * comes out unrealistically wide (approaching 100% of hands) - see pushFoldSolver.ts's
   * analogous correction for the same underlying issue in the shove/fold solver.
   */
  opponentsBehindCount?: number;
  iterations?: number;
}

export function solveDeepStackPosition(config: DeepStackConfig): DeepStackResult {
  const {
    table,
    deadMoneyPotBB,
    openSizeBB,
    threeBetSizeBB,
    equityMatrix: matrix,
    opponentsBehindCount = 1,
    iterations = 25,
  } = config;
  const heroStackBB = table.stacksBB[table.heroIdx];
  const villainStackBB = table.stacksBB[table.villainIdx];
  const heroIdx = table.heroIdx;
  const villainIdx = table.villainIdx;

  // Precompute constant ICM reference points that don't depend on the loop variable.
  const evVillainFoldsToOpenStacks = withHeroVillainStacks(
    table,
    heroStackBB + deadMoneyPotBB,
    villainStackBB
  ).stacksBB;
  const evVillainFoldsToOpen = icmEquity(evVillainFoldsToOpenStacks, CLUB_MATCH_POINTS_VECTOR);

  const heroFoldsToThreeBetStacks = withHeroVillainStacks(
    table,
    heroStackBB - openSizeBB,
    villainStackBB + deadMoneyPotBB + openSizeBB
  ).stacksBB;
  const evHeroFoldsToThreeBet = icmEquity(heroFoldsToThreeBetStacks, CLUB_MATCH_POINTS_VECTOR);

  const villainFoldsToShoveStacks = withHeroVillainStacks(
    table,
    heroStackBB + deadMoneyPotBB + threeBetSizeBB,
    villainStackBB - threeBetSizeBB
  ).stacksBB;
  const evVillainFoldsToShove = icmEquity(villainFoldsToShoveStacks, CLUB_MATCH_POINTS_VECTOR);

  const allIn = resolveAllIn(heroStackBB, villainStackBB, 0, 0, deadMoneyPotBB);
  const icmIfHeroWinsAllIn = icmEquity(
    withHeroVillainStacks(table, allIn.heroStackIfHeroWins, allIn.villainStackIfHeroWins).stacksBB,
    CLUB_MATCH_POINTS_VECTOR
  );
  const icmIfVillainWinsAllIn = icmEquity(
    withHeroVillainStacks(table, allIn.heroStackIfVillainWins, allIn.villainStackIfVillainWins)
      .stacksBB,
    CLUB_MATCH_POINTS_VECTOR
  );

  let rfi = seedUniformStrategy(["fold", "raise"]);
  let vsOpen = seedUniformStrategy(["fold", "call", "raise"]);
  let vs3bet = seedUniformStrategy(["fold", "call", "shove"]);
  let vs4bet = seedUniformStrategy(["fold", "call"]);

  for (let iter = 0; iter < iterations; iter++) {
    const sampleCount = iter + 2; // seed counts as one prior sample
    const heroShoveRangeAtVs3bet = rangeFromStrategyAction(vs3bet, "shove");

    // 1. villainVs4bet: facing hero's shove after villain's 3bet.
    const newVs4bet = new Map<string, StrategyMix>();
    for (const villainHand of ALL_HANDS) {
      const evFold = evVillainFoldsToShove[villainIdx];
      const equityVsShoveRange = equityVsRangeFromMatrix(
        villainHand,
        heroShoveRangeAtVs3bet,
        matrix
      );
      const evCall =
        equityVsShoveRange * icmIfVillainWinsAllIn[villainIdx] +
        (1 - equityVsShoveRange) * icmIfHeroWinsAllIn[villainIdx];
      const fresh = softmax({ fold: evFold, call: evCall });
      newVs4bet.set(villainHand, blendStrategy(vs4bet.get(villainHand)!, fresh, sampleCount));
    }
    vs4bet = newVs4bet;

    // 2. heroVs3bet: facing villain's 3bet after hero's open.
    const villainThreeBetRange = rangeFromStrategyAction(vsOpen, "raise");
    const newVs3bet = new Map<string, StrategyMix>();
    for (const heroHand of ALL_HANDS) {
      const evFold = evHeroFoldsToThreeBet[heroIdx];

      const equityVsThreeBetRange = equityVsRangeFromMatrix(
        heroHand,
        villainThreeBetRange,
        matrix
      );
      const showdown = resolveShowdownProxy(
        threeBetSizeBB,
        threeBetSizeBB,
        deadMoneyPotBB,
        equityVsThreeBetRange
      );
      const heroStackIfCall = heroStackBB + showdown.heroShare;
      const villainStackIfCall = villainStackBB + showdown.villainShare;
      const evCall = icmEquity(
        withHeroVillainStacks(table, heroStackIfCall, villainStackIfCall).stacksBB,
        CLUB_MATCH_POINTS_VECTOR
      )[heroIdx];

      let shoveWeightedEv = 0;
      let shoveWeightTotal = 0;
      for (const villainHand of ALL_HANDS) {
        const rangeWeight = villainThreeBetRange.get(villainHand) ?? 0;
        if (rangeWeight <= 0) continue;
        const comboWeight = rangeWeight * comboCount(villainHand);
        const villainResponse = vs4bet.get(villainHand)!;
        const pairEquity = villainHand === heroHand ? 0.5 : matrix[heroHand][villainHand];
        const evIfCalled =
          pairEquity * icmIfHeroWinsAllIn[heroIdx] +
          (1 - pairEquity) * icmIfVillainWinsAllIn[heroIdx];
        const evThisVillainHand =
          (villainResponse.fold ?? 0) * evVillainFoldsToShove[heroIdx] +
          (villainResponse.call ?? 0) * evIfCalled;
        shoveWeightedEv += comboWeight * evThisVillainHand;
        shoveWeightTotal += comboWeight;
      }
      const evShove =
        shoveWeightTotal > 0 ? shoveWeightedEv / shoveWeightTotal : evVillainFoldsToShove[heroIdx];

      const fresh = softmax({ fold: evFold, call: evCall, shove: evShove });
      newVs3bet.set(heroHand, blendStrategy(vs3bet.get(heroHand)!, fresh, sampleCount));
    }
    vs3bet = newVs3bet;

    // 3. villainVsOpen: facing hero's open.
    const heroOpenRange = rangeFromStrategyAction(rfi, "raise");
    const newVsOpen = new Map<string, StrategyMix>();
    for (const villainHand of ALL_HANDS) {
      const evFold = evVillainFoldsToOpen[villainIdx];

      const equityVsOpenRange = equityVsRangeFromMatrix(villainHand, heroOpenRange, matrix);
      const showdown = resolveShowdownProxy(
        openSizeBB,
        openSizeBB,
        deadMoneyPotBB,
        1 - equityVsOpenRange
      );
      const villainStackIfCall = villainStackBB + showdown.villainShare;
      const heroStackIfCall = heroStackBB + showdown.heroShare;
      const evCall = icmEquity(
        withHeroVillainStacks(table, heroStackIfCall, villainStackIfCall).stacksBB,
        CLUB_MATCH_POINTS_VECTOR
      )[villainIdx];

      const evVillainWinsHeroFoldedThreeBet = icmEquity(
        withHeroVillainStacks(
          table,
          heroStackBB - openSizeBB,
          villainStackBB + deadMoneyPotBB + openSizeBB
        ).stacksBB,
        CLUB_MATCH_POINTS_VECTOR
      )[villainIdx];

      let threeBetWeightedEv = 0;
      let threeBetWeightTotal = 0;
      for (const heroHand of ALL_HANDS) {
        const rangeWeight = heroOpenRange.get(heroHand) ?? 0;
        if (rangeWeight <= 0) continue;
        const comboWeight = rangeWeight * comboCount(heroHand);
        const heroResponse = vs3bet.get(heroHand)!;
        const pairEquity = villainHand === heroHand ? 0.5 : matrix[villainHand][heroHand];

        const showdownVs3bet = resolveShowdownProxy(
          threeBetSizeBB,
          threeBetSizeBB,
          deadMoneyPotBB,
          1 - pairEquity
        );
        const evHeroCallsThreeBet = icmEquity(
          withHeroVillainStacks(
            table,
            heroStackBB + showdownVs3bet.heroShare,
            villainStackBB + showdownVs3bet.villainShare
          ).stacksBB,
          CLUB_MATCH_POINTS_VECTOR
        )[villainIdx];

        const evIfCalledAllIn =
          (1 - pairEquity) * icmIfVillainWinsAllIn[villainIdx] +
          pairEquity * icmIfHeroWinsAllIn[villainIdx];
        const villainVs4betForThisHand = vs4bet.get(villainHand)!;
        const evHeroShovesThreeBet =
          (villainVs4betForThisHand.fold ?? 0) * evVillainFoldsToShove[villainIdx] +
          (villainVs4betForThisHand.call ?? 0) * evIfCalledAllIn;

        const evThisHeroHand =
          (heroResponse.fold ?? 0) * evVillainWinsHeroFoldedThreeBet +
          (heroResponse.call ?? 0) * evHeroCallsThreeBet +
          (heroResponse.shove ?? 0) * evHeroShovesThreeBet;

        threeBetWeightedEv += comboWeight * evThisHeroHand;
        threeBetWeightTotal += comboWeight;
      }
      const evThreeBet =
        threeBetWeightTotal > 0 ? threeBetWeightedEv / threeBetWeightTotal : evFold;

      const fresh = softmax({ fold: evFold, call: evCall, raise: evThreeBet });
      newVsOpen.set(villainHand, blendStrategy(vsOpen.get(villainHand)!, fresh, sampleCount));
    }
    vsOpen = newVsOpen;

    // 4. heroRfi: open or fold, unopened.
    let pFoldSingleWeighted = 0;
    let pFoldSingleWeightTotal = 0;
    for (const villainHand of ALL_HANDS) {
      const comboWeight = comboCount(villainHand);
      pFoldSingleWeighted += (vsOpen.get(villainHand)!.fold ?? 0) * comboWeight;
      pFoldSingleWeightTotal += comboWeight;
    }
    const pFoldSingleAvg = pFoldSingleWeighted / pFoldSingleWeightTotal;
    const pFoldEffective = Math.pow(pFoldSingleAvg, opponentsBehindCount);

    const newRfi = new Map<string, StrategyMix>();
    for (const heroHand of ALL_HANDS) {
      const evFold = icmEquity(table.stacksBB, CLUB_MATCH_POINTS_VECTOR)[heroIdx];

      let openWeightedEv = 0;
      let openWeightTotal = 0;
      for (const villainHand of ALL_HANDS) {
        const comboWeight = comboCount(villainHand);
        const villainResponse = vsOpen.get(villainHand)!;
        const pairEquity = villainHand === heroHand ? 0.5 : matrix[heroHand][villainHand];

        const showdownVsCall = resolveShowdownProxy(
          openSizeBB,
          openSizeBB,
          deadMoneyPotBB,
          pairEquity
        );
        const evCalled = icmEquity(
          withHeroVillainStacks(
            table,
            heroStackBB + showdownVsCall.heroShare,
            villainStackBB + showdownVsCall.villainShare
          ).stacksBB,
          CLUB_MATCH_POINTS_VECTOR
        )[heroIdx];

        const heroVs3betForThisHand = vs3bet.get(heroHand)!;
        const villainVs4betForThisHand = vs4bet.get(villainHand)!;
        const evIfCalledAllIn =
          pairEquity * icmIfHeroWinsAllIn[heroIdx] + (1 - pairEquity) * icmIfVillainWinsAllIn[heroIdx];
        const evHeroShovesVsThreeBet =
          (villainVs4betForThisHand.fold ?? 0) * evVillainFoldsToShove[heroIdx] +
          (villainVs4betForThisHand.call ?? 0) * evIfCalledAllIn;
        const evThreeBetBranch =
          (heroVs3betForThisHand.fold ?? 0) * evHeroFoldsToThreeBet[heroIdx] +
          (heroVs3betForThisHand.call ?? 0) *
            icmEquity(
              withHeroVillainStacks(
                table,
                heroStackBB +
                  resolveShowdownProxy(threeBetSizeBB, threeBetSizeBB, deadMoneyPotBB, pairEquity)
                    .heroShare,
                villainStackBB +
                  resolveShowdownProxy(threeBetSizeBB, threeBetSizeBB, deadMoneyPotBB, pairEquity)
                    .villainShare
              ).stacksBB,
              CLUB_MATCH_POINTS_VECTOR
            )[heroIdx] +
          (heroVs3betForThisHand.shove ?? 0) * evHeroShovesVsThreeBet;

        const evThisVillainHand =
          (villainResponse.fold ?? 0) * evVillainFoldsToOpen[heroIdx] +
          (villainResponse.call ?? 0) * evCalled +
          (villainResponse.raise ?? 0) * evThreeBetBranch;

        openWeightedEv += comboWeight * evThisVillainHand;
        openWeightTotal += comboWeight;
      }
      const evOpenRaw = openWeightTotal > 0 ? openWeightedEv / openWeightTotal : evFold;

      // Correct for the fact that opponentsBehindCount players could contest the open, not
      // just the single represented one - see the DeepStackConfig.opponentsBehindCount docs.
      const evContinueSingle =
        pFoldSingleAvg < 1
          ? (evOpenRaw - pFoldSingleAvg * evVillainFoldsToOpen[heroIdx]) / (1 - pFoldSingleAvg)
          : evOpenRaw;
      const evOpen =
        pFoldEffective * evVillainFoldsToOpen[heroIdx] + (1 - pFoldEffective) * evContinueSingle;

      const fresh = softmax({ fold: evFold, raise: evOpen });
      newRfi.set(heroHand, blendStrategy(rfi.get(heroHand)!, fresh, sampleCount));
    }
    rfi = newRfi;
  }

  return { rfi, vsOpen, vs3bet, vs4bet };
}
