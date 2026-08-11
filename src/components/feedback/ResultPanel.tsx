"use client";

import { useState } from "react";
import { actionHistoryKeyFor } from "@/domain/scenario/actionHistoryKey";
import { ScenarioState, StrategyMix } from "@/domain/scenario/scenarioState";
import { AdvisorSituation } from "@/engine/advisor/types";
import { lookupPreflopRange } from "@/engine/solver/solverLookup";
import { currentApiKey, getExplanation, missingApiKeyMessage } from "@/state/advisorDispatch";
import { useFormatStore } from "@/state/formatStore";
import { canonicalHandOf } from "@/domain/cards/handNotation";
import { FrequencyBar } from "./FrequencyBar";
import { RangeGrid } from "./RangeGrid";

export interface ResultPanelProps {
  scenario: ScenarioState;
  onNextHand: () => void;
}

/**
 * The preflop trainer's exact-solver answer is instant and free (no LLM involved for the
 * frequencies themselves), but doesn't come with a "why" - this adds an optional, on-demand AI
 * explanation of that already-known answer (see explainAdvisor.ts's getPreflopExplanation, which
 * is told to treat the frequencies as fixed rather than recompute them). Kept opt-in (a button,
 * not automatic) so the trainer stays instant/free/no-API-key-required by default.
 */
export function ResultPanel({ scenario, onNextHand }: ResultPanelProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Record<string, StrategyMix> | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);

  if (!scenario.solverRecommendation || !scenario.userAction || !scenario.heroCards) return null;
  const { solverRecommendation, userAction, heroCards } = scenario;

  const handleShowRange = async () => {
    setRangeLoading(true);
    setRangeError(null);
    try {
      const { format, cashRake } = useFormatStore.getState();
      const actionHistoryKey = actionHistoryKeyFor(scenario.actionHistory);
      const fullRange = await lookupPreflopRange(
        scenario.heroPosition,
        scenario.effectiveStackBB,
        actionHistoryKey,
        format,
        cashRake
      );
      setRange(fullRange);
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : "レンジ表の取得に失敗しました。");
    } finally {
      setRangeLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!currentApiKey()) {
      setError(missingApiKeyMessage());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const situation: AdvisorSituation = {
        format: useFormatStore.getState().format,
        street: "preflop",
        heroPosition: scenario.heroPosition,
        effectiveStackBB: scenario.effectiveStackBB,
        potBB: scenario.potBB,
        board: [],
        heroCards,
        actionsByStreet: { preflop: scenario.actionHistory },
        actualAction: userAction,
      };
      setExplanation(await getExplanation(situation, solverRecommendation));
    } catch (err) {
      setError(err instanceof Error ? err.message : "解説の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-zinc-300 bg-white p-4 shadow dark:border-zinc-700 dark:bg-zinc-900">
      <div
        className={`text-lg font-bold ${
          scenario.isCorrect ? "text-emerald-600" : "text-rose-600"
        }`}
      >
        {scenario.isCorrect ? "正解!" : "不正解"}
      </div>
      <div className="w-full">
        <div className="mb-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
          ソルバー推奨頻度
        </div>
        <FrequencyBar mix={solverRecommendation} />
      </div>

      {!range && (
        <button
          type="button"
          onClick={() => void handleShowRange()}
          disabled={rangeLoading}
          className="rounded-lg bg-zinc-200 px-4 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          {rangeLoading ? "読み込み中..." : "レンジ表全体を見る"}
        </button>
      )}
      {rangeError && <p className="text-sm text-rose-600 dark:text-rose-400">{rangeError}</p>}
      {range && <RangeGrid range={range} highlightHand={canonicalHandOf(heroCards[0], heroCards[1])} />}

      {!explanation && (
        <button
          type="button"
          onClick={() => void handleExplain()}
          disabled={loading}
          className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "解説を生成中..." : "なぜ?(AIに解説してもらう)"}
        </button>
      )}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {explanation && (
        <div className="w-full rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm whitespace-pre-wrap text-zinc-700 dark:border-sky-900 dark:bg-sky-950 dark:text-zinc-200">
          {explanation}
        </div>
      )}

      <button
        type="button"
        onClick={onNextHand}
        className="mt-1 rounded-lg bg-zinc-900 px-6 py-2 text-sm font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        次のハンド
      </button>
    </div>
  );
}
