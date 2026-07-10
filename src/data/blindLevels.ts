import { BlindLevel } from "@/domain/table/blinds";

/**
 * PLACEHOLDER blind structure for Poker Chase's club match ("通常" structure, 5-minute
 * levels, 15,000 starting stack, 6-max). The exact official level table is not published
 * anywhere we could find (checked poker-chase.com and third-party guides) - these numbers
 * are a reasonable stand-in modeled on typical 6-max SNG progressions.
 *
 * The solver keys everything off effective-stack-in-BB, not raw chip counts, so correcting
 * these numbers later (once verified in-app) does not require re-solving anything - only
 * this file needs to change.
 */
export const CLUB_MATCH_STARTING_STACK = 15000;
export const CLUB_MATCH_LEVEL_DURATION_MINUTES = 5;

export const BLIND_LEVELS: BlindLevel[] = [
  { level: 1, sb: 50, bb: 100, ante: 0, durationMinutes: 5 },
  { level: 2, sb: 75, bb: 150, ante: 0, durationMinutes: 5 },
  { level: 3, sb: 100, bb: 200, ante: 25, durationMinutes: 5 },
  { level: 4, sb: 150, bb: 300, ante: 25, durationMinutes: 5 },
  { level: 5, sb: 200, bb: 400, ante: 50, durationMinutes: 5 },
  { level: 6, sb: 300, bb: 600, ante: 75, durationMinutes: 5 },
  { level: 7, sb: 400, bb: 800, ante: 100, durationMinutes: 5 },
  { level: 8, sb: 500, bb: 1000, ante: 100, durationMinutes: 5 },
  { level: 9, sb: 600, bb: 1200, ante: 200, durationMinutes: 5 },
  { level: 10, sb: 800, bb: 1600, ante: 200, durationMinutes: 5 },
  { level: 11, sb: 1000, bb: 2000, ante: 300, durationMinutes: 5 },
  { level: 12, sb: 1500, bb: 3000, ante: 400, durationMinutes: 5 },
  { level: 13, sb: 2000, bb: 4000, ante: 500, durationMinutes: 5 },
  { level: 14, sb: 3000, bb: 6000, ante: 1000, durationMinutes: 5 },
  { level: 15, sb: 4000, bb: 8000, ante: 1000, durationMinutes: 5 },
];

export function blindLevelByIndex(level: number): BlindLevel {
  const found = BLIND_LEVELS.find((l) => l.level === level);
  if (!found) throw new Error(`Unknown blind level: ${level}`);
  return found;
}
