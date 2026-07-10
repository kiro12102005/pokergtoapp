import { Type } from "@google/genai";
import { z } from "zod";
import { ActionType, StrategyMix } from "@/domain/scenario/scenarioState";

/** Gemini responseSchema (OpenAPI-subset) config, forces structured JSON output. */
export const geminiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    frequencies: {
      type: Type.OBJECT,
      properties: {
        fold: { type: Type.NUMBER },
        check: { type: Type.NUMBER },
        call: { type: Type.NUMBER },
        raise: { type: Type.NUMBER },
        shove: { type: Type.NUMBER },
      },
    },
    // Suggested bet/raise-to size as % of the pot immediately before this action (e.g. 66 for a
    // pot-sized-ish bet), whenever frequencies.raise > 0. See promptBuilder.ts for the precise
    // instruction given to the model - kept as a single flat number rather than a per-sizing
    // frequency mix, since even the single-value frequencies mix already needs normalization
    // help from this model (see normalizeFrequencies below); a nested structure would be less
    // reliable, not more informative.
    sizePercentPot: { type: Type.NUMBER },
    rationale: { type: Type.STRING },
  },
  required: ["frequencies", "rationale"],
};

const frequenciesSchema = z
  .object({
    fold: z.number().min(0).optional(),
    check: z.number().min(0).optional(),
    call: z.number().min(0).optional(),
    raise: z.number().min(0).optional(),
    shove: z.number().min(0).optional(),
  })
  .refine(
    (mix) => Object.values(mix).some((v) => (v ?? 0) > 0),
    { message: "frequencies must contain at least one positive value" }
  );

/**
 * Validates a parsed LLM JSON response before it's trusted as an AdvisorResult. Deliberately
 * does NOT require frequencies to already sum to 1 - in practice this model reliably omits an
 * applicable action (e.g. dropping "call" while facing a bet) rather than proportioning
 * correctly, so requiring an exact sum here just turns a normalizable answer into a rejected
 * one. Call normalizeFrequencies() on the result before displaying/using it.
 */
export const advisorResponseSchema = z.object({
  frequencies: frequenciesSchema,
  sizePercentPot: z.number().min(0).max(1000).nullable().optional(),
  rationale: z.string().min(1),
});

/** Rescales a frequency mix so its values sum to 1, preserving their relative proportions. */
export function normalizeFrequencies(mix: StrategyMix): StrategyMix {
  const total = (Object.values(mix) as (number | undefined)[]).reduce<number>((sum, v) => sum + (v ?? 0), 0);
  if (total <= 0) return mix;
  const normalized: StrategyMix = {};
  for (const [action, value] of Object.entries(mix) as [ActionType, number | undefined][]) {
    if (value !== undefined) normalized[action] = value / total;
  }
  return normalized;
}
