import { Card, fullDeck } from "./card";

export type RandomSource = () => number;

/** Mulberry32 - small, fast, seedable PRNG so scenario generation can be made reproducible in tests. */
export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffledDeck(random: RandomSource = Math.random): Card[] {
  const deck = fullDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Deals `count` cards from a deck, excluding any cards already in `exclude`. */
export function dealExcluding(
  count: number,
  exclude: Card[],
  random: RandomSource = Math.random
): Card[] {
  const excludeSet = new Set(exclude.map((c) => `${c.rank}${c.suit}`));
  const available = fullDeck().filter((c) => !excludeSet.has(`${c.rank}${c.suit}`));
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, count);
}
