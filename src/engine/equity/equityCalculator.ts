import { Card, cardsEqual } from "@/domain/cards/card";
import { RandomSource, dealExcluding } from "@/domain/cards/deck";
import { enumerateCombos } from "@/domain/cards/handNotation";
import { evaluateBestOf7 } from "./sevenCardEvaluator";

function combosOverlap(a: [Card, Card], b: [Card, Card]): boolean {
  return a.some((ca) => b.some((cb) => cardsEqual(ca, cb)));
}

/** Deals a random 5-card board and returns 1 (hero wins), 0 (hero loses), or 0.5 (tie). */
export function headsUpTrialResult(
  hero: [Card, Card],
  villain: [Card, Card],
  random: RandomSource
): number {
  const board = dealExcluding(5, [...hero, ...villain], random);
  const heroScore = evaluateBestOf7([...hero, ...board]);
  const villainScore = evaluateBestOf7([...villain, ...board]);
  if (heroScore > villainScore) return 1;
  if (heroScore < villainScore) return 0;
  return 0.5;
}

export interface EquityOptions {
  /** How many distinct, non-overlapping (heroCombo, villainCombo) pairs to sample. */
  comboPairSamples?: number;
  /** How many random board runouts to average per sampled combo pair. */
  runoutsPerComboPair?: number;
  random?: RandomSource;
}

const DEFAULT_OPTIONS: Required<EquityOptions> = {
  comboPairSamples: 6,
  runoutsPerComboPair: 25,
  random: Math.random,
};

/**
 * Monte Carlo "cold" preflop equity of canonical hand A vs canonical hand B, averaged over
 * a sample of valid (non-card-overlapping) concrete combos and random board runouts. This is
 * the approximation this app documents as a stand-in for full postflop play - see the Phase 1
 * plan's "cold equity as terminal value proxy" note.
 */
export function canonicalHandVsHandEquity(
  handA: string,
  handB: string,
  options: EquityOptions = {}
): number {
  if (handA === handB) return 0.5; // exact by mirror-match symmetry, skip sampling

  const { comboPairSamples, runoutsPerComboPair, random } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const combosA = enumerateCombos(handA);
  const combosB = enumerateCombos(handB);

  const validPairs: Array<[[Card, Card], [Card, Card]]> = [];
  for (const a of combosA) {
    for (const b of combosB) {
      if (!combosOverlap(a, b)) validPairs.push([a, b]);
    }
  }
  if (validPairs.length === 0) return 0.5;

  const indices = [...Array(validPairs.length).keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const sampleCount = Math.min(comboPairSamples, validPairs.length);
  const chosen = indices.slice(0, sampleCount).map((i) => validPairs[i]);

  let total = 0;
  let trials = 0;
  for (const [a, b] of chosen) {
    for (let t = 0; t < runoutsPerComboPair; t++) {
      total += headsUpTrialResult(a, b, random);
      trials++;
    }
  }
  return total / trials;
}
