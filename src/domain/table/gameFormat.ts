/**
 * Which game this hand/scenario belongs to - a tournament ("クラブマッチ", PokerChase's club
 * match format, ICM/finish-position-points scored) or a cash/ring game (pure chip EV, no ICM
 * pressure, no ante by default). Threaded through the solver (see engine/solver/abstraction.ts),
 * the scenario generators, and the advisor prompt builder so both formats share the same code
 * paths rather than needing separate implementations - see the "リングキャッシュ対応" plan.
 */
export type GameFormat = "tournament" | "cash";

/** Cash-game rake, as a fraction of the contested pot (see engine/solver/gameTree.ts's
 *  resolveAllIn/resolveShowdownProxy) - meaningless for tournament (always 0; a tournament's
 *  "rake" is the buy-in, already sunk before the hand starts). The three tiers are the common
 *  real-world presets: no rake, 5%, and 10%. */
export type CashRakePercent = 0 | 0.05 | 0.1;

export const CASH_RAKE_OPTIONS: CashRakePercent[] = [0, 0.05, 0.1];
