import { describe, it, expect } from "vitest";
import { seededRandom } from "@/domain/cards/deck";
import { generateRandomScenario } from "@/domain/scenario/scenarioGenerator";
import { STACK_DEPTH_BUCKETS_BB } from "@/engine/solver/abstraction";

describe("generateRandomScenario with targetStackBB", () => {
  it("honors a forced stack-depth bucket (within its +/-20% jitter) across many seeds", () => {
    for (const bucket of STACK_DEPTH_BUCKETS_BB) {
      for (let seed = 0; seed < 20; seed++) {
        const { scenario } = generateRandomScenario(seededRandom(seed), { targetStackBB: bucket });
        expect(scenario.effectiveStackBB).toBeGreaterThanOrEqual(bucket * 0.8);
        expect(scenario.effectiveStackBB).toBeLessThanOrEqual(bucket * 1.2);
      }
    }
  });

  it("still varies hand to hand within the forced bucket rather than always landing on the exact value", () => {
    const stacks = new Set<number>();
    for (let seed = 0; seed < 10; seed++) {
      const { scenario } = generateRandomScenario(seededRandom(seed), { targetStackBB: 100 });
      stacks.add(scenario.effectiveStackBB);
    }
    expect(stacks.size).toBeGreaterThan(1);
  });

  it("is unaffected (same output) when no options are passed, vs. the default parameter", () => {
    const a = generateRandomScenario(seededRandom(7));
    const b = generateRandomScenario(seededRandom(7), {});
    expect(a).toEqual(b);
  });
});
