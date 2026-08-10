"use client";

import { Card, RANKS_HIGH_TO_LOW, SUITS, Suit, cardToDisplayString, cardsEqual } from "@/domain/cards/card";

const SUIT_COLOR: Record<Suit, string> = {
  s: "text-zinc-900 dark:text-zinc-100",
  c: "text-emerald-600 dark:text-emerald-400",
  h: "text-rose-600 dark:text-rose-400",
  d: "text-sky-600 dark:text-sky-400",
};

export interface CardPickerGridProps {
  disabledCards?: Card[];
  onSelect: (card: Card) => void;
  onClose?: () => void;
}

/** 13x4 clickable card grid - the direct-manipulation replacement for typing e.g. "As". */
export function CardPickerGrid({ disabledCards = [], onSelect, onClose }: CardPickerGridProps) {
  return (
    <div className="rounded-lg border border-zinc-300 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="grid w-[min(464px,calc(100vw-3rem))] grid-cols-[repeat(13,minmax(0,1fr))] gap-1">
        {RANKS_HIGH_TO_LOW.map((rank) =>
          SUITS.map((suit) => {
            const card: Card = { rank, suit };
            const disabled = disabledCards.some((c) => cardsEqual(c, card));
            return (
              <button
                key={`${rank}-${suit}`}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelect(card);
                  onClose?.();
                }}
                className={`flex aspect-square w-full items-center justify-center rounded text-[10px] font-semibold transition-colors sm:text-xs ${
                  disabled
                    ? "cursor-not-allowed bg-zinc-100 text-zinc-300 dark:bg-zinc-800 dark:text-zinc-700"
                    : `bg-zinc-50 hover:bg-amber-100 dark:bg-zinc-800 dark:hover:bg-amber-900 ${SUIT_COLOR[suit]}`
                }`}
              >
                {cardToDisplayString(card)}
              </button>
            );
          })
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded bg-zinc-200 py-1 text-xs text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
        >
          閉じる
        </button>
      )}
    </div>
  );
}
