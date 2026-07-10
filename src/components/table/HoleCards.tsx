"use client";

import { useState } from "react";
import { Card, cardToDisplayString } from "@/domain/cards/card";
import { CardPickerGrid } from "@/components/input/CardPickerGrid";

export interface HoleCardsProps {
  cards: [Card, Card] | null;
  onChangeCard: (index: 0 | 1, card: Card) => void;
}

const SUIT_IS_RED = (suit: Card["suit"]) => suit === "h" || suit === "d";

export function HoleCards({ cards, onChangeCard }: HoleCardsProps) {
  const [editingIndex, setEditingIndex] = useState<0 | 1 | null>(null);

  return (
    <div className="relative flex justify-center gap-2">
      {[0, 1].map((i) => {
        const idx = i as 0 | 1;
        const card = cards?.[idx];
        return (
          <div key={idx} className="relative">
            <button
              type="button"
              onClick={() => setEditingIndex(idx)}
              className={`flex h-16 w-12 items-center justify-center rounded-md border-2 border-zinc-300 bg-white text-lg font-bold shadow dark:border-zinc-600 dark:bg-zinc-100 ${
                card && SUIT_IS_RED(card.suit) ? "text-rose-600" : "text-zinc-900"
              }`}
            >
              {card ? cardToDisplayString(card) : "?"}
            </button>
            {editingIndex === idx && (
              <div className="absolute top-full left-1/2 z-20 mt-2 -translate-x-1/2">
                <CardPickerGrid
                  disabledCards={cards ? [cards[idx === 0 ? 1 : 0]] : []}
                  onSelect={(selected) => onChangeCard(idx, selected)}
                  onClose={() => setEditingIndex(null)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
