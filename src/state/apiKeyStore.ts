import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AdvisorProvider } from "@/engine/advisor/types";

interface ApiKeyState {
  /** Which LLM backend the postflop advisor (and preflop "why" explanation) currently calls -
   *  see advisorDispatch.ts's getAdvice()/getExplanation(). */
  provider: AdvisorProvider;
  geminiApiKey: string | null;
  claudeApiKey: string | null;
  setProvider: (provider: AdvisorProvider) => void;
  setGeminiApiKey: (key: string) => void;
  clearGeminiApiKey: () => void;
  setClaudeApiKey: (key: string) => void;
  clearClaudeApiKey: () => void;
}

/**
 * Persists the user's own Gemini and/or Claude API key, plus which one is currently selected, to
 * this browser's localStorage (via zustand's persist middleware) so they only have to enter it
 * once. Neither key ever touches this app's server - see geminiAdvisor.ts/claudeAdvisor.ts, which
 * call their respective API directly from the browser.
 */
export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set) => ({
      provider: "gemini",
      geminiApiKey: null,
      claudeApiKey: null,
      setProvider: (provider) => set({ provider }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key.trim() || null }),
      clearGeminiApiKey: () => set({ geminiApiKey: null }),
      setClaudeApiKey: (key) => set({ claudeApiKey: key.trim() || null }),
      clearClaudeApiKey: () => set({ claudeApiKey: null }),
    }),
    // Kept as the original localStorage key name (predates the Claude option) so existing
    // users' already-saved Gemini key isn't silently dropped by a rename.
    { name: "pokergto-gemini-api-key" }
  )
);
