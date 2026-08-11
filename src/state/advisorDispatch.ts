import { StrategyMix } from "@/domain/scenario/scenarioState";
import { getClaudeAdvice } from "@/engine/advisor/claudeAdvisor";
import { getClaudePreflopExplanation } from "@/engine/advisor/claudeExplainAdvisor";
import { getPreflopExplanation } from "@/engine/advisor/explainAdvisor";
import { getGeminiAdvice } from "@/engine/advisor/geminiAdvisor";
import { AdvisorResult, AdvisorSituation } from "@/engine/advisor/types";
import { useApiKeyStore } from "./apiKeyStore";

/** The API key for whichever provider the user currently has selected (see apiKeyStore.ts's
 *  `provider` field) - null if that provider's key hasn't been set yet. Callers that need an
 *  early "is a key configured" check without triggering a network call (e.g. to keep a UI's
 *  retry affordance visible instead of collapsing into an error card - see
 *  postflopTrainStore.ts) should use this rather than duplicating the provider branch. */
export function currentApiKey(): string | null {
  const { provider, geminiApiKey, claudeApiKey } = useApiKeyStore.getState();
  return provider === "claude" ? claudeApiKey : geminiApiKey;
}

/** The Japanese "please set an API key" message for whichever provider is currently selected. */
export function missingApiKeyMessage(): string {
  return useApiKeyStore.getState().provider === "claude"
    ? "Claude APIキーを設定してください。"
    : "Gemini APIキーを設定してください。";
}

/**
 * Routes an advisor call to whichever provider (Gemini/Claude) the user has selected in
 * apiKeyStore, using that provider's own saved key - so callers (analyzeStore, postflopTrainStore)
 * don't need their own provider branching. getGeminiAdvice()/getClaudeAdvice() each already throw
 * an AdvisorError with a provider-specific Japanese message when handed an empty key, so this
 * doesn't need its own presence check.
 */
export async function getAdvice(situation: AdvisorSituation): Promise<AdvisorResult> {
  const { provider, geminiApiKey, claudeApiKey } = useApiKeyStore.getState();
  if (provider === "claude") return getClaudeAdvice(situation, claudeApiKey ?? "");
  return getGeminiAdvice(situation, geminiApiKey ?? "");
}

/** Routes a "explain this already-known frequency mix" call the same way getAdvice() routes a
 *  full recommendation - see ResultPanel.tsx's handleExplain(). */
export async function getExplanation(situation: AdvisorSituation, frequencies: StrategyMix): Promise<string> {
  const { provider, geminiApiKey, claudeApiKey } = useApiKeyStore.getState();
  if (provider === "claude") return getClaudePreflopExplanation(situation, frequencies, claudeApiKey ?? "");
  return getPreflopExplanation(situation, frequencies, geminiApiKey ?? "");
}
