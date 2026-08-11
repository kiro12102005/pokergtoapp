"use client";

import { useState } from "react";
import { buildHandGrid } from "@/domain/cards/handNotation";
import { ACTION_LABEL_JA } from "@/domain/scenario/labels";
import { ActionType, StrategyMix } from "@/domain/scenario/scenarioState";
import { ACTION_BAR_COLOR } from "./FrequencyBar";

// Fixed stacking order within a cell (bottom-to-top) - never reordered by magnitude, so the same
// action always occupies the same visual position across every cell (see dataviz skill's "color
// follows the entity, never its rank"). "check" is omitted - the preflop trainer's rfi/vsOpen/
// vs3bet/vs4bet situations never offer it.
const STACK_ORDER: ActionType[] = ["fold", "call", "raise", "shove"];

const GRID = buildHandGrid();
const RANK_LABELS = GRID[0].map((_, i) => GRID[i][i].hand[0]);

export interface RangeGridProps {
  /** Every hand's frequency mix for one situation - see solverLookup.ts's lookupPreflopRange(). */
  range: Record<string, StrategyMix>;
  /** The hand actually in play, ringed to help find it among the other 168 - see ResultPanel.tsx. */
  highlightHand?: string;
  /** "BET" instead of "RAISE" in the detail line, matching FrequencyBar's same override for an
   *  opening (nobody has acted yet) decision vs. responding to one - preflop's rfi is the only
   *  situation type this component is ever shown for, so callers pass this at their discretion. */
  raiseLabel?: string;
}

/**
 * 13x13 preflop range heatmap - pairs on the diagonal, suited upper-right, offsuit lower-left
 * (the standard layout, see buildHandGrid()). Each cell is a small vertical stacked bar (not a
 * single dominant color) so a genuinely mixed-strategy hand (e.g. "raise 70% / fold 30%") reads
 * as mixed rather than getting rounded to whichever action happens to be largest.
 */
export function RangeGrid({ range, highlightHand, raiseLabel }: RangeGridProps) {
  const [selected, setSelected] = useState<string | null>(highlightHand ?? null);
  const selectedMix = selected ? range[selected] : undefined;

  const labelFor = (action: ActionType) => (action === "raise" ? (raiseLabel ?? ACTION_LABEL_JA.raise) : ACTION_LABEL_JA[action]);

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="grid w-full max-w-sm gap-[2px]" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
        {GRID.flatMap((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const mix = range[cell.hand];
            const isHighlighted = cell.hand === highlightHand;
            const isSelected = cell.hand === selected;
            return (
              <button
                key={cell.hand}
                type="button"
                title={`${cell.hand}${
                  mix
                    ? ": " +
                      STACK_ORDER.filter((a) => (mix[a] ?? 0) > 0.001)
                        .map((a) => `${labelFor(a)} ${((mix[a] ?? 0) * 100).toFixed(0)}%`)
                        .join(" / ")
                    : ""
                }`}
                onClick={() => setSelected(cell.hand)}
                className={`relative flex aspect-square flex-col overflow-hidden rounded-[2px] ring-inset ${
                  isHighlighted
                    ? "ring-2 ring-emerald-500"
                    : isSelected
                      ? "ring-2 ring-zinc-900 dark:ring-zinc-100"
                      : ""
                }`}
              >
                {rowIndex === 0 && (
                  <span className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 text-[7px] font-bold text-zinc-400 dark:text-zinc-500">
                    {colIndex === 0 ? "" : RANK_LABELS[colIndex]}
                  </span>
                )}
                {colIndex === 0 && rowIndex > 0 && (
                  <span className="pointer-events-none absolute top-1/2 -left-3 -translate-y-1/2 text-[7px] font-bold text-zinc-400 dark:text-zinc-500">
                    {RANK_LABELS[rowIndex]}
                  </span>
                )}
                {mix ? (
                  <div className="flex h-full w-full flex-col-reverse">
                    {STACK_ORDER.filter((a) => (mix[a] ?? 0) > 0).map((a) => (
                      <div key={a} className={ACTION_BAR_COLOR[a]} style={{ height: `${(mix[a] ?? 0) * 100}%` }} />
                    ))}
                  </div>
                ) : (
                  <div className="h-full w-full bg-zinc-200 dark:bg-zinc-800" />
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-600 dark:text-zinc-300">
        {STACK_ORDER.map((action) => (
          <span key={action} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-sm ${ACTION_BAR_COLOR[action]}`} aria-hidden />
            {labelFor(action)}
          </span>
        ))}
      </div>

      {selectedMix && (
        <p className="text-center text-xs text-zinc-600 dark:text-zinc-300">
          <span className="font-mono font-bold">{selected}</span>:{" "}
          {STACK_ORDER.filter((a) => (selectedMix[a] ?? 0) > 0.001)
            .map((a) => `${labelFor(a)} ${((selectedMix[a] ?? 0) * 100).toFixed(0)}%`)
            .join(" / ")}
        </p>
      )}
    </div>
  );
}
