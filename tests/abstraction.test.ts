import { describe, it, expect } from "vitest";
import {
  ANTE_TO_BB_RATIO,
  CASH_ANTE_TO_BB_RATIO,
  CASH_STACK_DEPTH_BUCKETS_BB,
  STACK_DEPTH_BUCKETS_BB,
  anteToBBRatioFor,
  nearestStackBucket,
  situationKey,
  stackDepthBucketsFor,
} from "@/engine/solver/abstraction";

describe("stackDepthBucketsFor", () => {
  it("returns the tournament bucket set for tournament format", () => {
    expect(stackDepthBucketsFor("tournament")).toBe(STACK_DEPTH_BUCKETS_BB);
  });

  it("returns a deeper bucket set for cash format, extending (not replacing) the tournament one", () => {
    const cash = stackDepthBucketsFor("cash");
    expect(cash).toBe(CASH_STACK_DEPTH_BUCKETS_BB);
    expect(cash).toContain(200);
    expect(cash).toContain(150);
    for (const bucket of STACK_DEPTH_BUCKETS_BB) {
      expect(cash).toContain(bucket);
    }
  });
});

describe("anteToBBRatioFor", () => {
  it("cash games have no ante", () => {
    expect(anteToBBRatioFor("cash")).toBe(0);
    expect(CASH_ANTE_TO_BB_RATIO).toBe(0);
  });

  it("tournament keeps the existing placeholder ante ratio", () => {
    expect(anteToBBRatioFor("tournament")).toBe(ANTE_TO_BB_RATIO);
  });
});

describe("nearestStackBucket", () => {
  it("defaults to the tournament bucket set when none is passed", () => {
    expect(nearestStackBucket(95)).toBe(100);
    expect(nearestStackBucket(2)).toBe(3);
  });

  it("picks the nearest value from an explicitly-passed bucket list", () => {
    expect(nearestStackBucket(180, CASH_STACK_DEPTH_BUCKETS_BB)).toBe(200);
    expect(nearestStackBucket(120, CASH_STACK_DEPTH_BUCKETS_BB)).toBe(100);
  });
});

describe("situationKey", () => {
  it("includes the format so tournament and cash never collide", () => {
    const t = situationKey("BTN", 100, "rfi", "tournament", 0);
    const c = situationKey("BTN", 100, "rfi", "cash", 0);
    expect(t).not.toBe(c);
    expect(t).toContain("tournament");
    expect(c).toContain("cash");
  });

  it("includes the rake tier so different cash rake situations never collide", () => {
    const noRake = situationKey("BTN", 100, "rfi", "cash", 0);
    const fivePercent = situationKey("BTN", 100, "rfi", "cash", 0.05);
    const tenPercent = situationKey("BTN", 100, "rfi", "cash", 0.1);
    expect(new Set([noRake, fivePercent, tenPercent]).size).toBe(3);
  });
});
