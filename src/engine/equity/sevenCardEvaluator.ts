import { Card } from "@/domain/cards/card";
import { evaluate5 } from "./handEvaluator";

function combinations<T>(items: T[], k: number): T[][] {
  const results: T[][] = [];
  const combo: T[] = [];
  function recurse(start: number) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]);
      recurse(i + 1);
      combo.pop();
    }
  }
  recurse(0);
  return results;
}

const FIVE_CARD_COMBO_INDICES = combinations([0, 1, 2, 3, 4, 5, 6], 5);

/** Evaluates the best 5-card hand out of 7 cards (2 hole + 5 board at full showdown). */
export function evaluateBestOf7(cards: Card[]): number {
  if (cards.length !== 7) {
    throw new Error(`evaluateBestOf7 requires exactly 7 cards, got ${cards.length}`);
  }
  let best = -Infinity;
  for (const indices of FIVE_CARD_COMBO_INDICES) {
    const hand = indices.map((i) => cards[i]);
    const score = evaluate5(hand);
    if (score > best) best = score;
  }
  return best;
}
