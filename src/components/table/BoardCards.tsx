import { Card, cardToDisplayString } from "@/domain/cards/card";

export interface BoardCardsProps {
  board: Card[];
}

const SUIT_IS_RED = (suit: Card["suit"]) => suit === "h" || suit === "d";

/**
 * Renders the board cards. Unused while street === "preflop" in Phase 1; Phase 2 activates
 * this for flop/turn/river, reusing CardPickerGrid for board-card entry the same way
 * HoleCards.tsx does for hero's hand.
 */
export function BoardCards({ board }: BoardCardsProps) {
  if (board.length === 0) return null;
  return (
    <div className="flex justify-center gap-1">
      {board.map((card, i) => (
        <div
          key={i}
          className={`flex h-14 w-10 items-center justify-center rounded-md border-2 border-zinc-300 bg-white text-base font-bold shadow dark:border-zinc-600 dark:bg-zinc-100 ${
            SUIT_IS_RED(card.suit) ? "text-rose-600" : "text-zinc-900"
          }`}
        >
          {cardToDisplayString(card)}
        </div>
      ))}
    </div>
  );
}
