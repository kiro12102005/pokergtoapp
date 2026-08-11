"use client";

export interface PillSelectorOption<T extends string | number> {
  value: T;
  label: string;
}

export interface PillSelectorProps<T extends string | number> {
  value: T;
  options: PillSelectorOption<T>[];
  onChange: (v: T) => void;
}

/** Generic tap-to-select pill-button row - the same visual pattern PositionSelector already
 *  established (see input/PositionSelector.tsx), generalized for any small enumerable option
 *  set (pot type, street, stack depth, ...) so each new filter doesn't reimplement the same
 *  button styling. */
export function PillSelector<T extends string | number>({ value, options, onChange }: PillSelectorProps<T>) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
            value === opt.value
              ? "bg-amber-600 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
