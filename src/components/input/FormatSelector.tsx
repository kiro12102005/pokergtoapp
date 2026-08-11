"use client";

import { CASH_RAKE_OPTIONS, CashRakePercent, GameFormat } from "@/domain/table/gameFormat";
import { useFormatStore } from "@/state/formatStore";
import { HelpTooltip } from "@/components/feedback/HelpTooltip";
import { PillSelector } from "./PillSelector";

const FORMAT_OPTIONS: { value: GameFormat; label: string }[] = [
  { value: "tournament", label: "クラブマッチ" },
  { value: "cash", label: "リングキャッシュ" },
];

const RAKE_OPTIONS: { value: CashRakePercent; label: string }[] = CASH_RAKE_OPTIONS.map((r) => ({
  value: r,
  label: r === 0 ? "レーキなし" : `${Math.round(r * 100)}%`,
}));

/**
 * Shared format(クラブマッチ/リングキャッシュ) + レーキ toggle, backed by formatStore so the
 * selection is shared across /train and /analyze. Changing format only affects the *next*
 * generated hand or submitted analysis - same "takes effect on next action" semantics the
 * existing stack-depth/position filters already use - so no explicit refresh is wired here.
 *
 * Wrapped in a labeled, bordered box (matching PostflopTrainPanel's filter-box pattern) rather
 * than bare pill rows - unlabeled pills stacked directly under the page's other pill rows (mode
 * toggle, street toggle, position/stack-depth filters) read as visual noise since nothing marks
 * which row controls what.
 */
export function FormatSelector() {
  const { format, cashRake, setFormat, setCashRake } = useFormatStore();
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
        対戦形式
        <HelpTooltip text="クラブマッチ(順位ポイント制のトーナメント)とリングキャッシュ(純チップEV、レーキあり)のどちらで練習・分析するかを切り替えます。プリフロップの厳密解はそれぞれ別に計算されています。" />
      </div>
      <PillSelector value={format} options={FORMAT_OPTIONS} onChange={setFormat} />
      {format === "cash" && (
        <>
          <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">レーキ</div>
          <PillSelector value={cashRake} options={RAKE_OPTIONS} onChange={setCashRake} />
        </>
      )}
    </div>
  );
}
