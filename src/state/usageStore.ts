import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AdvisorProvider } from "@/engine/advisor/types";

interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

const EMPTY_PROVIDER_USAGE: ProviderUsage = { inputTokens: 0, outputTokens: 0, calls: 0 };

interface UsageState {
  claude: ProviderUsage;
  gemini: ProviderUsage;
  /** ISO timestamp usage has accumulated since - either first ever call or the last reset(). */
  since: string;
  /** Adds one API call's token counts to the running total - called from every advisor call site
   *  (claudeAdvisor.ts/claudeExplainAdvisor.ts/geminiAdvisor.ts/explainAdvisor.ts) right after a
   *  successful response, including retried calls, since a retry is billed too. */
  record: (provider: AdvisorProvider, inputTokens: number, outputTokens: number) => void;
  reset: () => void;
}

/**
 * Tracks cumulative token usage per AI provider across this app's own advisor calls, persisted to
 * this browser's localStorage - lets ApiKeyUsageSummary.tsx show the user roughly how much
 * they've spent on their own key without any server-side accounting (there is no server; see
 * apiKeyStore.ts's doc comment on why calls go straight from the browser to the provider).
 */
export const useUsageStore = create<UsageState>()(
  persist(
    (set) => ({
      claude: EMPTY_PROVIDER_USAGE,
      gemini: EMPTY_PROVIDER_USAGE,
      since: new Date().toISOString(),
      record: (provider, inputTokens, outputTokens) =>
        set((state) => ({
          [provider]: {
            inputTokens: state[provider].inputTokens + inputTokens,
            outputTokens: state[provider].outputTokens + outputTokens,
            calls: state[provider].calls + 1,
          },
        })),
      reset: () => set({ claude: EMPTY_PROVIDER_USAGE, gemini: EMPTY_PROVIDER_USAGE, since: new Date().toISOString() }),
    }),
    { name: "pokergto-ai-usage" }
  )
);
