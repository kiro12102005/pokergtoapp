import { defaultRangeHands, defaultRangePercent, Playstyle, PLAYSTYLE_LABEL_JA, rangePercentForPlaystyle } from "./handStrength";

export type VillainRangeMode = "auto" | "percent" | "playstyle" | "manual";

export interface VillainRangeConfig {
  mode: VillainRangeMode;
  /** Used by "percent" mode - a user-chosen top-N% width, independent of the stage-aware default. */
  percent: number;
  /** Used by "playstyle" mode. */
  playstyle: Playstyle;
  /** Used by "manual" mode - the existing 13x13 grid selection. */
  manualHands: string[];
}

export const DEFAULT_VILLAIN_RANGE_CONFIG: VillainRangeConfig = {
  mode: "auto",
  percent: 30,
  playstyle: "tag",
  manualHands: [],
};

export interface ResolvedVillainRange {
  hands: string[];
  description: string;
}

/**
 * Turns one opponent's range configuration into concrete hands plus a human-readable
 * description, for whichever mode is active. `effectiveStackBB`/`playersRemaining` only affect
 * "auto" mode (see handStrength.ts's defaultRangePercent) - the other modes are user-specified
 * and don't depend on stack/table-size context.
 */
export function resolveVillainRange(
  config: VillainRangeConfig,
  label: string,
  effectiveStackBB: number,
  playersRemaining?: number
): ResolvedVillainRange {
  switch (config.mode) {
    case "manual":
      return {
        hands: config.manualHands,
        description: `${label}の想定レンジ: 手動指定(${config.manualHands.length}種)`,
      };
    case "percent": {
      const hands = defaultRangeHands(config.percent);
      return { hands, description: `${label}の想定レンジ: 上位${config.percent.toFixed(0)}%(パーセント指定)` };
    }
    case "playstyle": {
      const percent = rangePercentForPlaystyle(config.playstyle);
      const hands = defaultRangeHands(percent);
      return {
        hands,
        description: `${label}の想定レンジ: ${PLAYSTYLE_LABEL_JA[config.playstyle]}(上位${percent.toFixed(0)}%相当)`,
      };
    }
    case "auto":
    default: {
      const percent = defaultRangePercent(effectiveStackBB, playersRemaining);
      const hands = defaultRangeHands(percent);
      return {
        hands,
        description: `${label}の想定レンジ: 上位${percent.toFixed(0)}%(自動・${effectiveStackBB}BB${
          playersRemaining ? `・残り${playersRemaining}人` : ""
        }を考慮)`,
      };
    }
  }
}
