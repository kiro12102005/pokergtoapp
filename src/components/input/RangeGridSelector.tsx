"use client";

import { ALL_HANDS, buildHandGrid, comboCount } from "@/domain/cards/handNotation";

export interface RangeGridSelectorProps {
  selectedHands: string[];
  onToggleHand: (hand: string) => void;
  onResetToDefault: () => void;
  onClear: () => void;
}

const GRID = buildHandGrid();
const TOTAL_COMBOS = ALL_HANDS.reduce((sum, hand) => sum + comboCount(hand), 0);

/**
 * A 13x13 clickable preflop range grid (standard convention: diagonal = pairs, upper-right =
 * suited, lower-left = offsuit) for manually building a villain range - the alternative to the
 * stack/table-size-derived default range (see handStrength.ts's defaultRangePercent).
 */
export function RangeGridSelector({
  selectedHands,
  onToggleHand,
  onResetToDefault,
  onClear,
}: RangeGridSelectorProps) {
  const selectedSet = new Set(selectedHands);
  const selectedCombos = selectedHands.reduce((sum, h) => sum + comboCount(h), 0);
  const selectedPercent = TOTAL_COMBOS > 0 ? (selectedCombos / TOTAL_COMBOS) * 100 : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid w-[min(336px,calc(100vw-3rem))] grid-cols-[repeat(13,minmax(0,1fr))] gap-0.5">
        {GRID.flat().map((cell) => {
          const selected = selectedSet.has(cell.hand);
          return (
            <button
              key={`${cell.row}-${cell.col}`}
              type="button"
              onClick={() => onToggleHand(cell.hand)}
              title={cell.hand}
              className={`flex aspect-square w-full items-center justify-center rounded-[3px] text-[8px] font-semibold transition-colors sm:text-[9px] ${
                selected
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {cell.hand}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          選択中: {selectedHands.length}種類({selectedPercent.toFixed(0)}%)
        </span>
        <button
          type="button"
          onClick={onResetToDefault}
          className="rounded bg-zinc-200 px-2 py-1 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          自動レンジから開始
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded bg-rose-100 px-2 py-1 text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300"
        >
          クリア
        </button>
      </div>
    </div>
  );
}
