import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ApiKeyState {
  geminiApiKey: string | null;
  setGeminiApiKey: (key: string) => void;
  clearGeminiApiKey: () => void;
}

/**
 * Persists the user's own Gemini API key to this browser's localStorage (via zustand's
 * persist middleware) so they only have to enter it once. The key never touches this app's
 * server - see geminiAdvisor.ts, which calls the Gemini API directly from the browser.
 */
export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set) => ({
      geminiApiKey: null,
      setGeminiApiKey: (key) => set({ geminiApiKey: key.trim() || null }),
      clearGeminiApiKey: () => set({ geminiApiKey: null }),
    }),
    { name: "pokergto-gemini-api-key" }
  )
);
