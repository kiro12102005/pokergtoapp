import { describe, it, expect } from "vitest";
import { hasPreflopSituation, lookupPreflopStrategy } from "@/engine/solver/solverLookup";
import { ALL_HANDS } from "@/domain/cards/handNotation";
import { GameFormat } from "@/domain/table/gameFormat";

const FORMATS: GameFormat[] = ["tournament", "cash"];

describe("solverLookup - both game formats", () => {
  it("has a precomputed rfi situation for every open position, at a representative depth in each format", async () => {
    for (const format of FORMATS) {
      for (const position of ["UTG", "HJ", "CO", "BTN", "SB"] as const) {
        expect(await hasPreflopSituation(position, 100, "rfi", format)).toBe(true);
      }
    }
  });

  it("cash supports deeper stack depths than tournament ever solves (150BB/200BB)", async () => {
    expect(await hasPreflopSituation("BTN", 200, "rfi", "cash")).toBe(true);
    // Tournament has no 200BB bucket - 200 rounds down to its nearest (100BB) bucket, which
    // does exist, so this only demonstrates cash's own deeper coverage, not tournament's absence.
    expect(await hasPreflopSituation("BTN", 200, "rfi", "tournament")).toBe(true);
  });

  it("frequencies sum to ~1 for a sample of hands in both formats", async () => {
    for (const format of FORMATS) {
      for (const hand of ["AA", "72o", "KQs"]) {
        const mix = await lookupPreflopStrategy("BTN", 100, "rfi", hand, format);
        const sum = Object.values(mix).reduce((a, b) => a + (b ?? 0), 0);
        expect(sum).toBeCloseTo(1, 1);
      }
    }
  });

  it("cash and tournament produce meaningfully different shove ranges at short stacks", async () => {
    // Both formats solve UTG|7BB|rfi (shove-only depth) - if the format wiring were accidentally
    // dropped (e.g. cash silently falling back to the tournament/ICM solve), these would be
    // identical. See the "why they differ" note in scripts/precompute-preflop.ts / abstraction.ts:
    // tournament's ante makes shoving profitable over a wider range than cash's ante-free game,
    // even though tournament ICM pressure alone would push the other way - the ante effect wins.
    let tournamentShoves = 0;
    let cashShoves = 0;
    for (const hand of ALL_HANDS) {
      const t = await lookupPreflopStrategy("UTG", 7, "rfi", hand, "tournament");
      const c = await lookupPreflopStrategy("UTG", 7, "rfi", hand, "cash");
      if ((t.shove ?? 0) > 0.5) tournamentShoves++;
      if ((c.shove ?? 0) > 0.5) cashShoves++;
    }
    expect(tournamentShoves).not.toBe(cashShoves);
  });

  it("hasPreflopSituation is false for a situation that was never solved (BB never opens)", async () => {
    // OPEN_POSITIONS in precompute-preflop.ts excludes BB - it's never the position that RFIs.
    for (const format of FORMATS) {
      expect(await hasPreflopSituation("BB", 100, "rfi", format)).toBe(false);
    }
  });

  it("lookupPreflopStrategy throws SolverLookupError for that same never-solved situation", async () => {
    await expect(lookupPreflopStrategy("BB", 100, "rfi", "AA", "tournament")).rejects.toThrow();
  });

  it("an out-of-range stack depth clamps to the nearest solved bucket rather than erroring", async () => {
    expect(await hasPreflopSituation("BTN", 999999, "vs4bet", "cash")).toBe(true);
  });

  it("higher rake monotonically tightens a marginal calling range (cash only)", async () => {
    // Rake reduces the net value of winning a contested pot, so higher rake should never widen
    // a calling range relative to a lower rake tier at the same spot - see gameTree.ts's
    // resolveShowdownProxy/resolveAllIn doc.
    const callWidth = async (rakePercent: 0 | 0.05 | 0.1) => {
      let count = 0;
      for (const hand of ALL_HANDS) {
        const mix = await lookupPreflopStrategy("SB", 15, "vsOpen", hand, "cash", rakePercent);
        if ((mix.call ?? 0) > 0.5) count++;
      }
      return count;
    };
    const noRake = await callWidth(0);
    const fivePercent = await callWidth(0.05);
    const tenPercent = await callWidth(0.1);
    expect(fivePercent).toBeLessThanOrEqual(noRake);
    expect(tenPercent).toBeLessThanOrEqual(fivePercent);
    expect(tenPercent).toBeLessThan(noRake);
  });

  it("tournament lookups ignore any rake argument (rake is meaningless outside cash)", async () => {
    const a = await lookupPreflopStrategy("BTN", 100, "rfi", "AA", "tournament");
    const b = await lookupPreflopStrategy("BTN", 100, "rfi", "AA", "tournament", 0.1);
    expect(a).toEqual(b);
  });
});
