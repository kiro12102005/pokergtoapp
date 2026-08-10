"use client";

import { useEffect } from "react";
import { Card, cardToDisplayString } from "@/domain/cards/card";
import { computeCurrentPot } from "@/domain/scenario/potCalculator";
import { ACTION_LABEL_JA, STREET_LABEL_JA } from "@/domain/scenario/labels";
import { Street } from "@/domain/scenario/scenarioState";
import { describePreflopPot } from "@/domain/scenario/postflopScenarioGenerator";
import { AdvisorResultPanel } from "@/components/feedback/AdvisorResultPanel";
import { ApiKeySettings } from "@/components/input/ApiKeySettings";
import { BoardCards } from "@/components/table/BoardCards";
import { PostflopActionBar } from "@/components/table/PostflopActionBar";
import { PotDisplay } from "@/components/table/PotDisplay";
import { usePostflopTrainStore } from "@/state/postflopTrainStore";

const SUIT_IS_RED = (suit: Card["suit"]) => suit === "h" || suit === "d";
const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river"];

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
 * Postflop practice: a random hand reaches a flop/turn/river decision point heads-up, hero picks
 * an action, and feedback comes from the same GTO-baseline + Gemini-exploit engine analyze mode
 * uses (see postflopTrainStore.ts) - there's no exact "correct answer" here the way the preflop
 * trainer's precomputed table has, so results are framed as reference values, not graded
 * right/wrong.
 */
export function PostflopTrainPanel() {
  const { scenario, result, loading, error, newHand, submitUserAction } = usePostflopTrainStore();

  useEffect(() => {
    if (!scenario) newHand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!scenario) return null;

  const potBB = computeCurrentPot(scenario.startingPotBB, scenario.actionsByStreet, scenario.street);
  // find() by position rather than assuming index 0 - a multiway hand's flop entry may have the
  // third player's fold listed before villain's bet (see generateRandomPostflopScenario).
  const villainBet = scenario.facingBet
    ? scenario.actionsByStreet[scenario.street]?.find((e) => e.position === scenario.villainPosition)
    : undefined;

  // Only hero/villain's own actions are worth showing - the other 4 seats' preflop folds add
  // noise without helping hero read the pot. Streets strictly before the decision point are
  // shown too (turn/river decisions inherit a flop/turn history) - only the decision street
  // itself is left out here, since its content is rendered separately below (board/bet/action bar).
  const priorStreetLines = STREET_ORDER.filter((s) => s !== scenario.street)
    .map((s) => {
      const actions = (scenario.actionsByStreet[s] ?? []).filter((e) => e.action !== "fold");
      if (actions.length === 0) return null;
      const line = actions.map((e) => `${e.position} ${ACTION_LABEL_JA[e.action]}${e.sizeBB !== undefined ? ` ${e.sizeBB}BB` : ""}`).join(" → ");
      return { street: s, line };
    })
    .filter((entry): entry is { street: Street; line: string } => entry !== null);

  const preflopActions = (scenario.actionsByStreet.preflop ?? []).filter((e) => e.action !== "fold");
  const { isThreeBetPot, isMultiway, openerPosition } = describePreflopPot(preflopActions);
  const heroRoleLabel = isThreeBetPot
    ? scenario.heroPosition === openerPosition
      ? "オープン→3ベットにコール"
      : "3ベット"
    : scenario.heroPosition === openerPosition
      ? "オープンレイズ"
      : "コール";

  return (
    <div className="flex flex-col items-center gap-4">
      <ApiKeySettings />

      <div className="flex flex-col items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full border border-emerald-300 px-2 py-0.5 font-semibold text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
            {STREET_LABEL_JA[scenario.street]}の局面
          </span>
          <span className="rounded-full border border-zinc-300 px-2 py-0.5 font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            {isThreeBetPot ? "3ベットポット" : "シングルレイズポット"}
          </span>
          {isMultiway && (
            <span className="rounded-full border border-amber-300 px-2 py-0.5 font-semibold text-amber-700 dark:border-amber-800 dark:text-amber-300">
              マルチウェイ(3人参加→フロップで1人フォールド)
            </span>
          )}
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">
            {scenario.heroPosition} · {Math.round(scenario.effectiveStackBB)}BB · {heroRoleLabel}
          </span>
          <span>vs {scenario.villainPosition}</span>
        </div>
        {priorStreetLines.map(({ street, line }) => (
          <div key={street}>
            {STREET_LABEL_JA[street]}: {line}
          </div>
        ))}
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
