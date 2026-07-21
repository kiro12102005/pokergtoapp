"use client";

import { useState } from "react";
import { Card, cardToDisplayString } from "@/domain/cards/card";
import { ACTION_LABEL_JA } from "@/domain/scenario/labels";
import { computeCurrentPot } from "@/domain/scenario/potCalculator";
import { Street } from "@/domain/scenario/scenarioState";
import { CardPickerGrid } from "@/components/input/CardPickerGrid";
import { PositionSelector } from "@/components/input/PositionSelector";
import { StackStepper } from "@/components/input/StackStepper";
import { ActionHistoryBuilder } from "@/components/input/ActionHistoryBuilder";
import { ApiKeySettings } from "@/components/input/ApiKeySettings";
import { PlayerStacksEditor } from "@/components/input/PlayerStacksEditor";
import { VillainRangeEditor } from "@/components/input/VillainRangeEditor";
import { AdvisorResultPanel } from "@/components/feedback/AdvisorResultPanel";
import { PromptCopyPanel } from "@/components/feedback/PromptCopyPanel";
import { useAnalyzeStore } from "@/state/analyzeStore";

const STREET_OPTIONS: { value: Street; label: string }[] = [
  { value: "preflop", label: "プリフロップ" },
  { value: "flop", label: "フロップ" },
  { value: "turn", label: "ターン" },
  { value: "river", label: "リバー" },
];

const SUIT_IS_RED = (suit: Card["suit"]) => suit === "h" || suit === "d";

function CardSlot({
  card,
  disabledCards,
  onSelect,
}: {
  card: Card | null;
  disabledCards: Card[];
  onSelect: (card: Card) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex h-14 w-10 items-center justify-center rounded-md border-2 border-zinc-300 bg-white text-base font-bold shadow dark:border-zinc-600 dark:bg-zinc-100 ${
          card && SUIT_IS_RED(card.suit) ? "text-rose-600" : "text-zinc-900"
        }`}
      >
        {card ? cardToDisplayString(card) : "?"}
      </button>
      {open && (
        <div className="absolute top-full left-1/2 z-20 mt-2 -translate-x-1/2">
          <CardPickerGrid
            disabledCards={disabledCards}
            onSelect={onSelect}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

const USAGE_STEPS = [
  "1. ヒーローのポジション・スタック・スターティングポット(ブラインド+アンティ)を選ぶ",
  "2. (任意)残っている他のプレイヤーのスタックを追加するとICM考慮の分析になる",
  "2.5 相手のレンジはプレイヤー(ポジション)ごとに設定できる: 自動推定・パーセント指定・プレイスタイル(タイト/LAG等)・グリッドで手動指定から選べる",
  "3. アクション履歴をポジションとアクションのボタンで1手ずつ追加する(ポットは自動計算)",
  "4. ヒーロー自身のアクションも履歴に含めると、その選択ごとに「正解だったか」の分析結果が個別に表示される(含めなければ「今何をすべきか」のみ表示)",
  "5. ストリートをフロップ・ターン・リバーと進める(それまでのアクションとボードは保持される)",
  "6. ボードとヒーローのハンドをカードから選ぶ",
  "7. 「分析する」を押す(フロップ以降やICM考慮時はGemini APIキーが必要)",
  "8. 結果は2種類: 「GTO的視点」はポットオッズと計算済みエクイティによる数値ベースの判断、「エクスプロイト視点」はAIによる相手の傾向を踏まえた調整案",
];

export default function AnalyzePage() {
  const {
    street,
    heroPosition,
    effectiveStackBB,
    startingPotBB,
    board,
    heroCards,
    actionsByStreet,
    otherPlayers,
    extraContext,
    villainRanges,
    selectedRangePosition,
    loading,
    error,
    results,
    setStreet,
    setHeroPosition,
    setEffectiveStackBB,
    setStartingPotBB,
    setBoardCard,
    setHeroCard,
    addActionEvent,
    removeLastActionEvent,
    addOtherPlayer,
    updateOtherPlayer,
    removeOtherPlayer,
    setExtraContext,
    setSelectedRangePosition,
    setRangeMode,
    setRangePercent,
    setRangePlaystyle,
    toggleManualRangeHand,
    resetManualRangeToDefault,
    clearManualRange,
    submit,
    buildCurrentPrompt,
  } = useAnalyzeStore();

  const allSelectedCards = [...board, ...heroCards].filter((c): c is Card => c !== null);
  const currentActionHistory = actionsByStreet[street] ?? [];
  const currentPotBB = computeCurrentPot(startingPotBB, actionsByStreet, street);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-bold">シチュエーション分析</h1>
        <p className="max-w-md text-center text-xs text-zinc-500 dark:text-zinc-400">
          プリフロップは事前計算テーブルの厳密解、それ以外(または他プレイヤーのスタックを入力した場合)はAIによるICM考慮の概算アドバイスを返します。
        </p>
        <details className="w-full max-w-md rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
          <summary className="cursor-pointer font-semibold text-zinc-600 dark:text-zinc-300">
            使い方
          </summary>
          <ol className="mt-1 flex flex-col gap-0.5 text-zinc-600 dark:text-zinc-400">
            {USAGE_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
      </header>

      <ApiKeySettings />

      <div className="flex flex-wrap justify-center gap-1">
        {STREET_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStreet(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              street === opt.value
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">ヒーローのポジション</div>
        <PositionSelector
          value={heroPosition}
          onChange={(v) => v !== "random" && setHeroPosition(v)}
        />
      </div>

      <div className="flex justify-center">
        <StackStepper valueBB={effectiveStackBB} onChange={setEffectiveStackBB} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          スターティングポット(ブラインド+アンティ, BB)
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStartingPotBB(startingPotBB - 0.5)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-lg font-bold hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            −
          </button>
          <span className="w-16 text-center text-lg font-semibold tabular-nums">{startingPotBB}BB</span>
          <button
            type="button"
            onClick={() => setStartingPotBB(startingPotBB + 0.5)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-lg font-bold hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            +
          </button>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          現在のポット(自動計算): <span className="font-semibold text-zinc-700 dark:text-zinc-200">{currentPotBB.toFixed(1)}BB</span>
        </div>
      </div>

      <PlayerStacksEditor
        heroPosition={heroPosition}
        otherPlayers={otherPlayers}
        onAdd={addOtherPlayer}
        onUpdate={updateOtherPlayer}
        onRemove={removeOtherPlayer}
      />

      <VillainRangeEditor
        heroPosition={heroPosition}
        otherPlayers={otherPlayers}
        effectiveStackBB={effectiveStackBB}
        villainRanges={villainRanges}
        selectedPosition={selectedRangePosition}
        onSelectPosition={setSelectedRangePosition}
        onSetMode={setRangeMode}
        onSetPercent={setRangePercent}
        onSetPlaystyle={setRangePlaystyle}
        onToggleManualHand={toggleManualRangeHand}
        onResetManualToDefault={resetManualRangeToDefault}
        onClearManual={clearManualRange}
      />

      {board.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">ボード</div>
          <div className="flex justify-center gap-1">
            {board.map((card, i) => (
              <CardSlot
                key={i}
                card={card}
                disabledCards={allSelectedCards.filter((c) => c !== card)}
                onSelect={(selected) => setBoardCard(i, selected)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">ヒーローのハンド</div>
        <div className="flex justify-center gap-1">
          {[0, 1].map((i) => (
            <CardSlot
              key={i}
              card={heroCards[i]}
              disabledCards={allSelectedCards.filter((c) => c !== heroCards[i])}
              onSelect={(selected) => setHeroCard(i as 0 | 1, selected)}
            />
          ))}
        </div>
      </div>

      {STREET_OPTIONS.filter((opt) => opt.value !== street && (actionsByStreet[opt.value]?.length ?? 0) > 0).length >
        0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <div className="font-semibold">これまでのアクション</div>
          {STREET_OPTIONS.filter((opt) => (actionsByStreet[opt.value]?.length ?? 0) > 0).map((opt) => (
            <div key={opt.value}>
              {opt.label}:{" "}
              {(actionsByStreet[opt.value] ?? [])
                .map((e) => `${e.position} ${ACTION_LABEL_JA[e.action]}${e.sizeBB !== undefined ? ` ${e.sizeBB}BB` : ""}`)
                .join(" → ")}
            </div>
          ))}
        </div>
      )}

      <ActionHistoryBuilder
        actionHistory={currentActionHistory}
        onAdd={addActionEvent}
        onRemoveLast={removeLastActionEvent}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="extra-context" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          補足情報(任意)
        </label>
        <textarea
          id="extra-context"
          value={extraContext}
          onChange={(e) => setExtraContext(e.target.value)}
          rows={2}
          placeholder="例: 相手はタイトなプレイヤー"
          className="rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <PromptCopyPanel prompt={buildCurrentPrompt()} />

      <button
        type="button"
        onClick={() => void submit()}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {loading ? "分析中(数秒〜30秒程度)..." : "分析する"}
      </button>

      {error && (
        <div className="rounded-lg border border-rose-400 bg-rose-50 p-3 text-center text-xs text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </div>
      )}

      <AdvisorResultPanel results={results} />
    </div>
  );
}
