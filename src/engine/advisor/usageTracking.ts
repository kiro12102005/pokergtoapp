import { AdvisorProvider } from "./types";

/**
 * USD per 1M tokens, as of 2026-08 - see /help for the same caveat shown to the user. Anthropic's
 * price is exact (claude-opus-5 is a pinned model id - see claudeAdvisor.ts). Google's is a
 * best-effort figure for gemini-2.5-flash-lite, since GEMINI_MODEL is a rolling "-latest" alias
 * (see geminiAdvisor.ts) that can silently point at a differently-priced model over time - the
 * UI must label this one "目安" (estimate), never state it as exact.
 */
const PRICING_USD_PER_MILLION: Record<AdvisorProvider, { input: number; output: number; exact: boolean }> = {
  claude: { input: 5.0, output: 25.0, exact: true },
  gemini: { input: 0.1, output: 0.4, exact: false },
};

export function isPriceExact(provider: AdvisorProvider): boolean {
  return PRICING_USD_PER_MILLION[provider].exact;
}

export function estimateCostUsd(provider: AdvisorProvider, inputTokens: number, outputTokens: number): number {
  const price = PRICING_USD_PER_MILLION[provider];
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
