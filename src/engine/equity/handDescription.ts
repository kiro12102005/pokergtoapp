import { Card } from "@/domain/cards/card";
import { CATEGORY_MULTIPLIER, evaluate5 } from "./handEvaluator";

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

/** Evaluates the best 5-card hand out of 5, 6, or 7 cards (hole cards + whatever board is out). */
export function evaluateBestHand(cards: Card[]): number {
  if (cards.length < 5) {
    throw new Error(`evaluateBestHand requires at least 5 cards, got ${cards.length}`);
  }
  if (cards.length === 5) return evaluate5(cards);

  let best = -Infinity;
  for (const combo of combinations(cards, 5)) {
    const score = evaluate5(combo);
    if (score > best) best = score;
  }
  return best;
}

const CATEGORY_LABEL_JA: Record<number, string> = {
  1: "ハイカード",
  2: "ワンペア",
  3: "ツーペア",
  4: "スリーカード",
  5: "ストレート",
  6: "フラッシュ",
  7: "フルハウス",
  8: "フォーカード",
  9: "ストレートフラッシュ",
};

/**
 * Renders a hand-evaluator score as a Japanese hand category name (e.g. "ツーペア"). Used to
 * hand the LLM advisor a deterministic, correct answer to "what hand does hero currently have"
 * instead of asking it to re-derive the best 5-card hand itself, which smaller models can get
 * wrong (e.g. misreading a two-pair board as a made straight).
 */
export function describeHandCategoryJa(score: number): string {
  const category = Math.floor(score / CATEGORY_MULTIPLIER);
  return CATEGORY_LABEL_JA[category] ?? "不明";
}
