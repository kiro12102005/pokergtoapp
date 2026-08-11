"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useScenarioStore } from "@/state/scenarioStore";
import { useFormatStore } from "@/state/formatStore";
import { PREFLOP_ACTION_ORDER, Position } from "@/domain/table/seats";
import { ActionType } from "@/domain/scenario/scenarioState";
import { POSTFLOP_STREET_ORDER, PostflopStreet } from "@/domain/scenario/postflopScenarioGenerator";
import { stackDepthBucketsFor } from "@/engine/solver/abstraction";
import { PokerTable } from "@/components/table/PokerTable";
import { ActionBar } from "@/components/table/ActionBar";
import { StackStepper } from "@/components/input/StackStepper";
import { PillSelector } from "@/components/input/PillSelector";
import { PositionSelector } from "@/components/input/PositionSelector";
import { FormatSelector } from "@/components/input/FormatSelector";
import { ResultPanel } from "@/components/feedback/ResultPanel";
import { PostflopTrainPanel } from "@/components/train/PostflopTrainPanel";
import { usePreflopStatsStore } from "@/state/preflopStatsStore";

type TrainMode = "preflop" | "postflop";

const MODE_OPTIONS: { value: TrainMode; label: string }[] = [
  { value: "preflop", label: "プリフロップ" },
  { value: "postflop", label: "ポストフロップ" },
];

function parsePosition(v: string | null): Position | undefined {
  return v && (PREFLOP_ACTION_ORDER as string[]).includes(v) ? (v as Position) : undefined;
}

function parsePostflopStreet(v: string | null): PostflopStreet | undefined {
  return v && (POSTFLOP_STREET_ORDER as string[]).includes(v) ? (v as PostflopStreet) : undefined;
}

function PreflopTrainPanel({ initialPosition }: { initialPosition?: Position }) {
  const {
    scenario,
    actionHistoryKey,
    lookupError,
    handsPlayed,
    handsCorrect,
    newHand,
    submitUserAction,
    setHeroCard,
    setEffectiveStackBB,
  } = useScenarioStore();
  const preflopStatsError = usePreflopStatsStore((s) => s.error);
  const format = useFormatStore((s) => s.format);
  const [preferredPosition, setPreferredPosition] = useState<Position | "random">(initialPosition ?? "random");
  const [preferredStackBB, setPreferredStackBB] = useState<number | "random">("random");

  const stackDepthOptions: { value: number | "random"; label: string }[] = [
    { value: "random", label: "ランダム" },
    ...stackDepthBucketsFor(format).map((bb) => ({ value: bb, label: `${bb}BB` })),
  ];

  useEffect(() => {
    if (!scenario) newHand({ preferredPosition, preferredStackBB });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewHand = () => newHand({ preferredPosition, preferredStackBB });

  const availableActions: ActionType[] = scenario?.solverRecommendation
    ? (Object.keys(scenario.solverRecommendation) as ActionType[])
    : [];

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">出題ポジション</div>
          <PositionSelector value={preferredPosition} onChange={setPreferredPosition} />
          <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">スタック深度</div>
          <PillSelector value={preferredStackBB} options={stackDepthOptions} onChange={setPreferredStackBB} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleNewHand}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            New Hand
          </button>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {handsCorrect}/{handsPlayed} 正解
          </span>
        </div>
        {preflopStatsError && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">成績の記録に失敗しました({preflopStatsError})</p>
        )}
      </div>

      {scenario && (
        <>
          <PokerTable scenario={scenario} onChangeHeroCard={(index, card) => setHeroCard(index, card)} />

          {!scenario.userAction && (
            <StackStepper valueBB={scenario.effectiveStackBB} onChange={setEffectiveStackBB} />
          )}

          {lookupError && (
            <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-center text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              この組み合わせは未計算です(この設定は事前計算テーブルの範囲外です)。New
              Handでやり直してください。
            </div>
          )}

          {!scenario.userAction && !lookupError && availableActions.length > 0 && (
            <ActionBar
              availableActions={availableActions}
              actionHistoryKey={actionHistoryKey ?? "rfi"}
              effectiveStackBB={scenario.effectiveStackBB}
              onAction={(action, sizeBB) => submitUserAction(action, sizeBB)}
            />
          )}

          {scenario.userAction && <ResultPanel scenario={scenario} onNextHand={handleNewHand} />}
        </>
      )}
    </>
  );
}

/** Reads ?mode=/?street=/?position= (set by the leak-finder's "practice this weak spot" links -
 *  see /history/stats/page.tsx) and pre-selects the corresponding mode/filter before the first
 *  hand deals. useSearchParams() requires a Suspense boundary (see the default export below) -
 *  this component is the one wrapped in it. */
function TrainPageInner() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<TrainMode>(() => (searchParams.get("mode") === "postflop" ? "postflop" : "preflop"));
  const initialPosition = parsePosition(searchParams.get("position"));
  const initialStreet = parsePostflopStreet(searchParams.get("street"));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-bold">練習</h1>
        <FormatSelector />
        <div className="flex flex-wrap justify-center gap-1">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                mode === opt.value
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {mode === "postflop" && (
          <p className="max-w-md text-center text-xs text-zinc-500 dark:text-zinc-400">
            フロップ・ターン・リバーいずれかの局面が出題されます(ヘッズアップのみ)。事前計算された厳密解ではなく、GTOベースライン(計算値)とAIによるエクスプロイト評価を参考値として表示します。
          </p>
        )}
      </header>

      {mode === "preflop" ? (
        <PreflopTrainPanel initialPosition={initialPosition} />
      ) : (
        <PostflopTrainPanel initialStreet={initialStreet} initialPosition={initialPosition} />
      )}
    </div>
  );
}

export default function TrainPage() {
  return (
    <Suspense fallback={<div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4" />}>
      <TrainPageInner />
    </Suspense>
  );
}
