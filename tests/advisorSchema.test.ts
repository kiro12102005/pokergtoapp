import { describe, it, expect } from "vitest";
import { advisorResponseSchema, normalizeFrequencies } from "@/engine/advisor/schema";

describe("advisorResponseSchema", () => {
  it("accepts a well-formed response whose frequencies sum to 1", () => {
    const result = advisorResponseSchema.safeParse({
      frequencies: { check: 0.4, raise: 0.6 },
      rationale: "ボードがヒーローに有利なため積極的にプレイする。",
    });
    expect(result.success).toBe(true);
  });

  it("accepts frequencies that don't sum to 1 - normalization handles that downstream", () => {
    // Observed in practice: the model reliably omits an applicable action (e.g. dropping
    // "call" while facing a bet) rather than proportioning correctly. Rejecting here would
    // throw away an otherwise-usable answer; see normalizeFrequencies() below instead.
    const belowOne = advisorResponseSchema.safeParse({
      frequencies: { fold: 0.7, raise: 0.1 },
      rationale: "reasoning",
    });
    expect(belowOne.success).toBe(true);

    const aboveOne = advisorResponseSchema.safeParse({
      frequencies: { fold: 0.8, call: 0.8 },
      rationale: "reasoning",
    });
    expect(aboveOne.success).toBe(true);
  });

  it("rejects frequencies that are all zero", () => {
    const result = advisorResponseSchema.safeParse({
      frequencies: { fold: 0, call: 0 },
      rationale: "reasoning",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing rationale", () => {
    const result = advisorResponseSchema.safeParse({
      frequencies: { fold: 1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative frequency", () => {
    const result = advisorResponseSchema.safeParse({
      frequencies: { fold: -0.1, call: 1.1 },
      rationale: "reasoning",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a response with a suggested bet/raise size", () => {
    const result = advisorResponseSchema.safeParse({
      frequencies: { check: 0.3, raise: 0.7 },
      sizePercentPot: 66,
      rationale: "reasoning",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a response with no sizing suggested (e.g. no raise in the mix)", () => {
    const result = advisorResponseSchema.safeParse({
      frequencies: { check: 1 },
      rationale: "reasoning",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative sizing value", () => {
    const result = advisorResponseSchema.safeParse({
      frequencies: { raise: 1 },
      sizePercentPot: -10,
      rationale: "reasoning",
    });
    expect(result.success).toBe(false);
  });
});

describe("normalizeFrequencies", () => {
  it("leaves an already-normalized mix unchanged", () => {
    const result = normalizeFrequencies({ fold: 0.4, call: 0.6 });
    expect(result.fold).toBeCloseTo(0.4, 6);
    expect(result.call).toBeCloseTo(0.6, 6);
  });

  it("rescales a mix that sums below 1, preserving relative proportions", () => {
    // The reported bug case: model omits "call" and returns fold/raise/shove summing to 0.8.
    const result = normalizeFrequencies({ fold: 0.7, raise: 0.1 });
    const sum = (result.fold ?? 0) + (result.raise ?? 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(result.fold! / result.raise!).toBeCloseTo(0.7 / 0.1, 6);
  });

  it("rescales a mix that sums above 1", () => {
    const result = normalizeFrequencies({ fold: 0.8, call: 0.8 });
    const sum = (result.fold ?? 0) + (result.call ?? 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(result.fold).toBeCloseTo(0.5, 6);
  });

  it("returns the input unchanged when everything is zero (nothing to normalize)", () => {
    const result = normalizeFrequencies({ fold: 0, call: 0 });
    expect(result).toEqual({ fold: 0, call: 0 });
  });
});
