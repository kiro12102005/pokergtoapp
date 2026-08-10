"use client";

import { useEffect, useState } from "react";
import { useScenarioStore } from "@/state/scenarioStore";
import { Position } from "@/domain/table/seats";
import { ActionType } from "@/domain/scenario/scenarioState";
import { PokerTable } from "@/components/table/PokerTable";
import { ActionBar } from "@/components/table/ActionBar";
import { StackStepper } from "@/components/input/StackStepper";
import { PositionSelector } from "@/components/input/PositionSelector";
import { ResultPanel } from "@/components/feedback/ResultPanel";
import { PostflopTrainPanel } from "@/components/train/PostflopTrainPanel";

type TrainMode = "preflop" | "postflop";

const MODE_OPTIONS: { value: TrainMode; label: string }[] = [
  { value: "preflop", label: "プリフロップ" },
  { value: "postflop", label: "ポストフロップ" },
];

function PreflopTrainPanel() {
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
  const [preferredPosition, setPreferredPosition] = useState<Position | "random">("random");

  useEffect(() => {
    if (!scenario) newHand({ preferredPosition });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewHand = () => newHand({ preferredPosition });

  const availableActions: ActionType[] = scenario?.solverRecommendation
    ? (Object.keys(scenario.solverRecommendation) as ActionType[])
    : [];

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <PositionSelector value={preferredPosition} onChange={setPreferredPosition} />
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

export default function TrainPage() {
  const [mode, setMode] = useState<TrainMode>("preflop");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-bold">練習</h1>
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
            フロップの局面のみ対応(v1)。事前計算された厳密解ではなく、GTOベースライン(計算値)とGemini
            APIによるエクスプロイト評価を参考値として表示します。
          </p>
        )}
      </header>

      {mode === "preflop" ? <PreflopTrainPanel /> : <PostflopTrainPanel />}
    </div>
  );
}
