import { GoogleGenAI } from "@google/genai";
import { StrategyMix } from "@/domain/scenario/scenarioState";
import { buildExplainPrompt } from "./explainPromptBuilder";
import { explainGeminiResponseSchema, explainResponseSchema } from "./explainSchema";
import { AdvisorError, AdvisorSituation } from "./types";

// Same alias-not-a-dated-id reasoning as geminiAdvisor.ts.
const GEMINI_MODEL = "gemini-flash-lite-latest";
const REQUEST_TIMEOUT_MS = 30_000;

class RetryableExplainError extends AdvisorError {}

async function requestExplanation(system: string, user: string, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const call = async (): Promise<string> => {
    let text: string | undefined;
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseSchema: explainGeminiResponseSchema,
          temperature: 0.3,
          // Text-only prompt (no image/video), but generous anyway - see handImporter.ts's note
          // on this model's thinking tokens sharing the same output budget.
          maxOutputTokens: 4096,
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

    if (!text) throw new RetryableExplainError("Gemini API returned an empty response.");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new RetryableExplainError("Gemini API returned invalid JSON.");
    }

    const parsed = explainResponseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new RetryableExplainError(`Gemini API response failed validation: ${parsed.error.message}`);
    }
    return parsed.data.explanation;
  };

  try {
    return await call();
  } catch (err) {
    if (err instanceof RetryableExplainError) return await call();
    throw err;
  }
}

/**
 * Explains an already-known, exact frequency mix (the preflop trainer's precomputed solver
 * answer - see solverLookup.ts) in plain-language theory terms, addressing hero's actual choice
 * when given. Unlike getGeminiAdvice(), this never computes a recommendation itself.
 */
export async function getPreflopExplanation(
  situation: AdvisorSituation,
  frequencies: StrategyMix,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new AdvisorError("Gemini APIキーが設定されていません。");
  }
  const { system, user } = buildExplainPrompt(situation, frequencies);
  return requestExplanation(system, user, apiKey);
}
