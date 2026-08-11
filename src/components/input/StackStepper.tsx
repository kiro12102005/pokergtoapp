"use client";

import { STACK_DEPTH_BUCKETS_BB, stackDepthBucketsFor } from "@/engine/solver/abstraction";
import { useFormatStore } from "@/state/formatStore";

export interface StackStepperProps {
  valueBB: number;
  onChange: (valueBB: number) => void;
}

/** +/- buttons, a drag slider, and BB-depth presets - no free-text stack entry. Presets/slider
 *  range come from the current format's bucket list (see abstraction.ts's stackDepthBucketsFor) -
 *  cash goes up to 200BB, so a fixed tournament-only preset row would leave cash's deepest
 *  buckets unreachable via quick-pick. */
export function StackStepper({ valueBB, onChange }: StackStepperProps) {
  const format = useFormatStore((s) => s.format);
  const buckets = stackDepthBucketsFor(format);
  const maxBB = Math.max(...buckets, ...STACK_DEPTH_BUCKETS_BB);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, Math.round(valueBB - 1)))}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-lg font-bold hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          −
        </button>
        <span className="w-20 text-center text-lg font-semibold tabular-nums">
          {Math.round(valueBB)}BB
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(maxBB, Math.round(valueBB + 1)))}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-lg font-bold hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          +
        </button>
      </div>
      <input
        type="range"
        min={1}
        max={maxBB}
        value={Math.round(valueBB)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-600"
      />
      <div className="flex flex-wrap justify-center gap-1">
        {buckets.map((bucket) => (
          <button
            key={bucket}
            type="button"
            onClick={() => onChange(bucket)}
            className="rounded bg-zinc-100 px-2 py-1 text-xs hover:bg-amber-100 dark:bg-zinc-800 dark:hover:bg-amber-900"
          >
            {bucket}BB
          </button>
        ))}
      </div>
    </div>
  );
}
