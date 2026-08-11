import Anthropic from "@anthropic-ai/sdk";
import { friendlyClaudeError } from "@/lib/claude/errorMessage";
import { StrategyMix } from "@/domain/scenario/scenarioState";
import { buildAdvisorPrompt } from "./promptBuilder";
import { advisorResponseSchema, claudeOutputSchema, normalizeFrequencies } from "./schema";
import { AdvisorError, AdvisorResult, AdvisorSituation } from "./types";

// Claude has no free tier the way Gemini's flash-lite does, so this app doesn't try to pick a
// cheaper model on the user's behalf - it defaults to Anthropic's current flagship, same as any
// other fresh Claude integration in this app's tooling conventions.
const CLAUDE_MODEL = "claude-opus-5";
const REQUEST_TIMEOUT_MS = 30_000;

class RetryableAdvisorError extends AdvisorError {}

async function requestAdvice(system: string, user: string, apiKey: string): Promise<AdvisorResult> {
  // Client-side only, same as GoogleGenAI above - the key goes straight from this browser to
  // Anthropic, never through this app's own server.
  const client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, dangerouslyAllowBrowser: true });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
      // Structured output, mirroring Gemini's responseSchema constraint (see schema.ts). Low
      // effort keeps this fast/cheap for a single small JSON decision - thinking is left on
      // (adaptive, the model's default) rather than disabled, since disabling it on this model
      // can leak stray tool-call text or <thinking> tags into an otherwise-JSON response.
      output_config: { format: { type: "json_schema", schema: claudeOutputSchema }, effort: "low" },
    });
  } catch (err) {
    throw new AdvisorError(friendlyClaudeError(err));
  }

  // Elevated safety classifiers can decline a request outright (HTTP 200, empty/partial
  // content) - treat it as a one-off worth a silent retry rather than a hard failure, same
  // policy as a malformed JSON response below.
  if (response.stop_reason === "refusal") {
    throw new RetryableAdvisorError("Claude API refused the request.");
  }

  let text: string | undefined;
  for (const block of response.content) {
    if (block.type === "text") {
      text = block.text;
      break;
    }
  }

  if (!text) {
    throw new RetryableAdvisorError("Claude API returned an empty response.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new RetryableAdvisorError("Claude API returned invalid JSON.");
  }

  const parsed = advisorResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new RetryableAdvisorError(`Claude API response failed validation: ${parsed.error.message}`);
  }

  return {
    provider: "claude",
    frequencies: normalizeFrequencies(parsed.data.frequencies as StrategyMix),
    sizePercentPot: parsed.data.sizePercentPot ?? undefined,
    rationale: parsed.data.rationale,
  };
}

/**
 * Calls the Claude API to get an approximate (non-exact) postflop strategy recommendation - the
 * Claude-backed counterpart to geminiAdvisor.ts's getGeminiAdvice(). Shares the same prompt
 * builder and Zod validation/normalization as the Gemini path so both providers are asked the
 * same question and held to the same output contract. Runs entirely in the browser using the
 * caller's own API key.
 */
export async function getClaudeAdvice(situation: AdvisorSituation, apiKey: string): Promise<AdvisorResult> {
  if (!apiKey) {
    throw new AdvisorError("Claude APIキーが設定されていません。");
  }

  const { system, user } = buildAdvisorPrompt(situation);

  try {
    return await requestAdvice(system, user, apiKey);
  } catch (err) {
    // Same one-silent-retry policy as getGeminiAdvice() - a malformed response or refusal is
    // often a one-off sampling hiccup rather than a persistent failure.
    if (err instanceof RetryableAdvisorError) {
      return await requestAdvice(system, user, apiKey);
    }
    throw err;
  }
}
