import { Card, cardsEqual, fullDeck } from "@/domain/cards/card";
import { RandomSource, dealExcluding } from "@/domain/cards/deck";
import { enumerateCombos } from "@/domain/cards/handNotation";
import { evaluateBestHand } from "./handDescription";

function overlaps(a: Card[], b: Card[]): boolean {
  return a.some((ca) => b.some((cb) => cardsEqual(ca, cb)));
}

function outcomeScore(heroScore: number, villainScore: number): number {
  if (heroScore > villainScore) return 1;
  if (heroScore < villainScore) return 0;
  return 0.5;
}

export interface EquityVsRangeOptions {
  /** Monte Carlo runouts per villain combo, used only when 2 board cards remain (the flop -
   *  exact enumeration there is expensive; 0 or 1 remaining cards are always evaluated
   *  exactly, matching equityCalculator.ts's existing Monte Carlo pattern for the analogous
   *  preflop case). */
  runoutsPerCombo?: number;
  random?: RandomSource;
}

/**
 * Hero's equity against a weighted set of canonical villain hands on a specific (possibly
 * incomplete) board. Villain combos that conflict with hero's hand or the known board are
 * skipped. This is the deterministic, non-LLM "actual equity" half of the pot-odds-vs-equity
 * comparison - see potOdds.ts for the "required equity" half.
 */
export function computeEquityVsRange(
  heroCards: [Card, Card],
  board: Card[],
  villainRangeHands: string[],
  options: EquityVsRangeOptions = {}
): number {
  const { runoutsPerCombo = 40, random = Math.random } = options;
  const remaining = 5 - board.length;
  if (remaining < 0 || remaining > 2) {
    throw new Error(`computeEquityVsRange expects a 3-5 card board, got ${board.length} cards`);
  }

  let weightedWins = 0;
  let totalWeight = 0;

  for (const hand of villainRangeHands) {
    for (const combo of enumerateCombos(hand)) {
      if (overlaps(combo, heroCards) || overlaps(combo, board)) continue;

      if (remaining === 0) {
        const heroScore = evaluateBestHand([...heroCards, ...board]);
        const villainScore = evaluateBestHand([...combo, ...board]);
        weightedWins += outcomeScore(heroScore, villainScore);
        totalWeight += 1;
        continue;
      }

      if (remaining === 1) {
        const used = [...heroCards, ...combo, ...board];
        const river = fullDeck().filter((c) => !used.some((u) => cardsEqual(u, c)));
        for (const riverCard of river) {
          const finalBoard = [...board, riverCard];
          const heroScore = evaluateBestHand([...heroCards, ...finalBoard]);
          const villainScore = evaluateBestHand([...combo, ...finalBoard]);
          weightedWins += outcomeScore(heroScore, villainScore);
          totalWeight += 1;
        }
        continue;
      }

      // remaining === 2 (flop): Monte Carlo sample turn+river runouts to bound cost.
      for (let i = 0; i < runoutsPerCombo; i++) {
        const runout = dealExcluding(remaining, [...heroCards, ...combo, ...board], random);
        const finalBoard = [...board, ...runout];
        const heroScore = evaluateBestHand([...heroCards, ...finalBoard]);
        const villainScore = evaluateBestHand([...combo, ...finalBoard]);
        weightedWins += outcomeScore(heroScore, villainScore);
        totalWeight += 1;
      }
    }
  }

  return totalWeight > 0 ? weightedWins / totalWeight : 0.5;
}
