"use client";

import { PREFLOP_ACTION_ORDER, Position } from "@/domain/table/seats";

export interface PositionSelectorProps {
  value: Position | "random";
  onChange: (value: Position | "random") => void;
}

/** Tap-to-select preferred practice position - no free text. */
export function PositionSelector({ value, onChange }: PositionSelectorProps) {
  const options: (Position | "random")[] = ["random", ...PREFLOP_ACTION_ORDER];
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === option
              ? "bg-amber-600 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          {option === "random" ? "ランダム" : option}
        </button>
      ))}
    </div>
  );
}
