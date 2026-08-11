"use client";

import { CASH_RAKE_OPTIONS, CashRakePercent, GameFormat } from "@/domain/table/gameFormat";
import { useFormatStore } from "@/state/formatStore";
import { PillSelector } from "./PillSelector";

const FORMAT_OPTIONS: { value: GameFormat; label: string }[] = [
  { value: "tournament", label: "クラブマッチ" },
  { value: "cash", label: "リングキャッシュ" },
];

const RAKE_OPTIONS: { value: CashRakePercent; label: string }[] = CASH_RAKE_OPTIONS.map((r) => ({
  value: r,
  label: r === 0 ? "レーキなし" : `レーキ${Math.round(r * 100)}%`,
}));

/**
 * Shared format(クラブマッチ/リングキャッシュ) + レーキ toggle, backed by formatStore so the
 * selection is shared across /train and /analyze. Changing format only affects the *next*
 * generated hand or submitted analysis - same "takes effect on next action" semantics the
 * existing stack-depth/position filters already use - so no explicit refresh is wired here.
 */
export function FormatSelector() {
  const { format, cashRake, setFormat, setCashRake } = useFormatStore();
  return (
    <div className="flex flex-col items-center gap-1">
      <PillSelector value={format} options={FORMAT_OPTIONS} onChange={setFormat} />
      {format === "cash" && <PillSelector value={cashRake} options={RAKE_OPTIONS} onChange={setCashRake} />}
    </div>
  );
}
