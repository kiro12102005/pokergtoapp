"use client";

import { useEffect } from "react";
import { Card, cardToDisplayString } from "@/domain/cards/card";
import { computeCurrentPot } from "@/domain/scenario/potCalculator";
import { AdvisorResultPanel } from "@/components/feedback/AdvisorResultPanel";
import { ApiKeySettings } from "@/components/input/ApiKeySettings";
import { BoardCards } from "@/components/table/BoardCards";
import { PostflopActionBar } from "@/components/table/PostflopActionBar";
import { PotDisplay } from "@/components/table/PotDisplay";
import { usePostflopTrainStore } from "@/state/postflopTrainStore";

const SUIT_IS_RED = (suit: Card["suit"]) => suit === "h" || suit === "d";

/** Read-only version of HoleCards.tsx's card rendering - hero's hand here is randomly dealt as
 *  part of a coherent scenario (board, stacks, bet already committed), not user-editable the way
 *  the preflop trainer's practice hand is. */
function ReadOnlyHoleCards({ cards }: { cards: [Card, Card] }) {
  return (
    <div className="flex justify-center gap-2">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`flex h-16 w-12 items-center justify-center rounded-md border-2 border-zinc-300 bg-white text-lg font-bold shadow dark:border-zinc-600 dark:bg-zinc-100 ${
            SUIT_IS_RED(card.suit) ? "text-rose-600" : "text-zinc-900"
          }`}
        >
          {cardToDisplayString(card)}
        </div>
      ))}
    </div>
  );
}

/**
 * Flop-only postflop practice: a random hand reaches the flop heads-up, hero picks an action,
 * and feedback comes from the same GTO-baseline + Gemini-exploit engine analyze mode uses (see
 * postflopTrainStore.ts) - there's no exact "correct answer" here the way the preflop trainer's
 * precomputed table has, so results are framed as reference values, not graded right/wrong.
 */
export function PostflopTrainPanel() {
  const { scenario, result, loading, error, newHand, submitUserAction } = usePostflopTrainStore();

  useEffect(() => {
    if (!scenario) newHand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!scenario) return null;

  const potBB = computeCurrentPot(scenario.startingPotBB, scenario.actionsByStreet, scenario.street);
  const villainBet = scenario.facingBet ? scenario.actionsByStreet.flop?.[0] : undefined;

  return (
    <div className="flex flex-col items-center gap-4">
      <ApiKeySettings />

      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-semibold text-zinc-700 dark:text-zinc-200">
          {scenario.heroPosition} · {Math.round(scenario.effectiveStackBB)}BB
        </span>
        <span>vs {scenario.villainPosition}</span>
      </div>

      <PotDisplay potBB={potBB} />
      <BoardCards board={scenario.board} />
      <ReadOnlyHoleCards cards={scenario.heroCards} />

      {villainBet && (
        <div className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          {scenario.villainPosition}が{villainBet.sizeBB?.toFixed(1)}BBベット
        </div>
      )}

      {!result && !loading && (
        <PostflopActionBar
          facingBet={scenario.facingBet}
          potBB={potBB}
          betAmountBB={villainBet?.sizeBB}
          effectiveStackBB={scenario.effectiveStackBB}
          onAction={(action, sizeBB) => void submitUserAction(action, sizeBB)}
        />
      )}

      {loading && (
        <p className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-400/40 border-t-zinc-400" />
          AIが評価中(数秒〜30秒程度)...
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-rose-400 bg-rose-50 p-3 text-center text-xs text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </div>
      )}

      {result && <AdvisorResultPanel results={[result]} />}

      {result && (
        <button
          type="button"
          onClick={() => newHand()}
          className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          次のハンド
        </button>
      )}
    </div>
  );
}
