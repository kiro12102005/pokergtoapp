import { GoogleGenAI } from "@google/genai";
import { StrategyMix } from "@/domain/scenario/scenarioState";
import { buildAdvisorPrompt } from "./promptBuilder";
import { advisorResponseSchema, geminiResponseSchema, normalizeFrequencies } from "./schema";
import { AdvisorError, AdvisorResult, AdvisorSituation } from "./types";

// An alias (not a dated model id) so it keeps resolving to Google's current free-tier-eligible
// lite flash model as they rotate versions, rather than 404ing when a specific version retires
// (gemini-2.5-flash and gemini-2.5-flash-lite both already 404 "no longer available to new
// users" as of this writing - see project memory for the models tried).
const GEMINI_MODEL = "gemini-flash-lite-latest";
const REQUEST_TIMEOUT_MS = 30_000;

class RetryableAdvisorError extends AdvisorError {}

async function requestAdvice(system: string, user: string, apiKey: string): Promise<AdvisorResult> {
  const ai = new GoogleGenAI({ apiKey });

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: user,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseSchema: geminiResponseSchema,
        // Low, not zero - the model's default temperature made repeated calls on an identical
        // (or near-identical, e.g. re-analyzing after progressing a street) prompt return
        // noticeably different frequencies/rationale each time, which reads as an inconsistent
        // or untrustworthy tool rather than a genuinely close/marginal spot. A low temperature
        // keeps answers stable across repeat calls without collapsing to a single greedy token
        // path.
        temperature: 0.2,
        // This model thinks by default before answering, and thinking tokens are drawn from
        // the same output budget as the final JSON - without enough headroom, the JSON can
        // come back truncated/invalid (observed in testing) for prompts with a longer action
        // history. The JSON payload itself is tiny, so this is pure headroom for thinking.
        maxOutputTokens: 3000,
        // Bounds the request so a stalled network/CORS issue always surfaces as an error
        // within 30s instead of leaving the caller's loading state stuck forever.
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    });
    text = response.text;
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    throw new AdvisorError(
      isTimeout
        ? "Gemini APIへの接続がタイムアウトしました。しばらくしてからもう一度お試しください。"
        : `Gemini API request failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!text) {
    throw new RetryableAdvisorError("Gemini API returned an empty response.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new RetryableAdvisorError("Gemini API returned invalid JSON.");
  }

  const parsed = advisorResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new RetryableAdvisorError(`Gemini API response failed validation: ${parsed.error.message}`);
  }

  return {
    provider: "gemini",
    // The model reliably omits an applicable action rather than proportioning correctly (e.g.
    // dropping "call" while facing a bet) - normalize rather than trust the raw values sum to 1.
    frequencies: normalizeFrequencies(parsed.data.frequencies as StrategyMix),
    sizePercentPot: parsed.data.sizePercentPot ?? undefined,
    rationale: parsed.data.rationale,
  };
}

/**
 * Calls the Gemini API to get an approximate (non-exact) postflop strategy recommendation.
 * Runs entirely in the browser using the caller's own API key - the key is never sent to
 * this app's own server, only directly to Google, so each user pays from their own free tier.
 */
export async function getGeminiAdvice(situation: AdvisorSituation, apiKey: string): Promise<AdvisorResult> {
  if (!apiKey) {
    throw new AdvisorError("Gemini APIキーが設定されていません。");
  }

  const { system, user } = buildAdvisorPrompt(situation);

  try {
    return await requestAdvice(system, user, apiKey);
  } catch (err) {
    // A malformed/invalid response is often a one-off sampling hiccup (especially on the
    // lite model) rather than a persistent failure - one silent retry before giving up.
    if (err instanceof RetryableAdvisorError) {
      return await requestAdvice(system, user, apiKey);
    }
    throw err;
  }
}
