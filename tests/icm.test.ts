import { describe, it, expect } from "vitest";
import { icmEquity, finishProbabilities } from "@/engine/icm/icm";
import { CLUB_MATCH_POINTS_VECTOR } from "@/engine/icm/pointsVector";

describe("icmEquity", () => {
  it("reduces to stackA / (stackA + stackB) heads-up winner-take-all", () => {
    const stacks = [6000, 4000];
    const payouts = [1, 0];
    const [equityA, equityB] = icmEquity(stacks, payouts);
    expect(equityA).toBeCloseTo(6000 / 10000, 6);
    expect(equityB).toBeCloseTo(4000 / 10000, 6);
  });

  it("sums finish probabilities to 1 for every player", () => {
    const stacks = [15000, 12000, 9000, 7000, 4000, 3000];
    const probs = finishProbabilities(stacks);
    for (const playerProbs of probs) {
      const sum = playerProbs.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it("gives the chip leader the highest points-EV under the club match points vector", () => {
    const stacks = [15000, 12000, 9000, 7000, 4000, 3000];
    const equities = icmEquity(stacks, CLUB_MATCH_POINTS_VECTOR);
    for (let i = 1; i < equities.length; i++) {
      expect(equities[0]).toBeGreaterThan(equities[i]);
    }
    // Monotonic with stack size given a monotonic payout vector.
    for (let i = 0; i < equities.length - 1; i++) {
      expect(equities[i]).toBeGreaterThanOrEqual(equities[i + 1]);
    }
  });

  it("matches equal equity for equal stacks (symmetry)", () => {
    const stacks = [5000, 5000, 5000, 5000, 5000, 5000];
    const equities = icmEquity(stacks, CLUB_MATCH_POINTS_VECTOR);
    const expected = CLUB_MATCH_POINTS_VECTOR.reduce((a, b) => a + b, 0) / 6;
    for (const e of equities) {
      expect(e).toBeCloseTo(expected, 6);
    }
  });
});
