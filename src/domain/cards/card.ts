export type Suit = "s" | "h" | "d" | "c";

export const SUITS: Suit[] = ["s", "h", "d", "c"];

/** 2-14, where 11=J, 12=Q, 13=K, 14=A */
export type Rank =
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14;

export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** Ranks ordered high-to-low, matching how preflop range grids are conventionally drawn. */
export const RANKS_HIGH_TO_LOW: Rank[] = [...RANKS].reverse();

const RANK_CHAR_BY_VALUE: Record<Rank, string> = {
  14: "A",
  13: "K",
  12: "Q",
  11: "J",
  10: "T",
  9: "9",
  8: "8",
  7: "7",
  6: "6",
  5: "5",
  4: "4",
  3: "3",
  2: "2",
};

const RANK_VALUE_BY_CHAR: Record<string, Rank> = Object.fromEntries(
  RANKS.map((r) => [RANK_CHAR_BY_VALUE[r], r])
) as Record<string, Rank>;

const SUIT_SYMBOL: Record<Suit, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

export interface Card {
  rank: Rank;
  suit: Suit;
}

export function rankChar(rank: Rank): string {
  return RANK_CHAR_BY_VALUE[rank];
}

export function rankFromChar(char: string): Rank {
  const rank = RANK_VALUE_BY_CHAR[char.toUpperCase()];
  if (!rank) throw new Error(`Invalid rank character: ${char}`);
  return rank;
}

export function cardToString(card: Card): string {
  return `${rankChar(card.rank)}${card.suit}`;
}

export function cardToDisplayString(card: Card): string {
  return `${rankChar(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}

/** Parses shorthand like "As", "Td", "7c". */
export function cardFromString(s: string): Card {
  if (s.length !== 2) throw new Error(`Invalid card string: ${s}`);
  const rank = rankFromChar(s[0]);
  const suit = s[1].toLowerCase() as Suit;
  if (!SUITS.includes(suit)) throw new Error(`Invalid suit in card string: ${s}`);
  return { rank, suit };
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}
