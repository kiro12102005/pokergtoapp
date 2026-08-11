"use client";

import { useState } from "react";

/** A small tap-to-toggle "?" badge for explaining a specific UI concept in place, without
 *  sending the user away to the /help page for every unfamiliar term. Tap-based (not
 *  hover-based) since this app is mobile-first and hover has no equivalent on touch. See
 *  /help/page.tsx for the fuller written explanations these excerpt from. */
export function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="説明を表示"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-400 text-[10px] font-bold text-zinc-500 hover:bg-zinc-100 dark:border-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        ?
      </button>
      {open && (
        <span className="absolute top-5 left-1/2 z-50 w-56 -translate-x-1/2 rounded-lg border border-zinc-300 bg-white p-2 text-left text-[11px] leading-relaxed font-normal text-zinc-600 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {text}
        </span>
      )}
    </span>
  );
}
