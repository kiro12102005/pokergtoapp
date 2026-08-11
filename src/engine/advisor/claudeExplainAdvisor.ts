import Anthropic from "@anthropic-ai/sdk";
import { friendlyClaudeError } from "@/lib/claude/errorMessage";
import { StrategyMix } from "@/domain/scenario/scenarioState";
import { buildExplainPrompt } from "./explainPromptBuilder";
import { claudeExplainOutputSchema, explainResponseSchema } from "./explainSchema";
import { AdvisorError, AdvisorSituation } from "./types";

// Same reasoning as claudeAdvisor.ts's CLAUDE_MODEL constant.
const CLAUDE_MODEL = "claude-opus-5";
const REQUEST_TIMEOUT_MS = 30_000;

class RetryableExplainError extends AdvisorError {}

async function requestExplanation(system: string, user: string, apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, dangerouslyAllowBrowser: true });

  const call = async (): Promise<string> => {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { format: { type: "json_schema", schema: claudeExplainOutputSchema }, effort: "low" },
      });
    } catch (err) {
      throw new AdvisorError(friendlyClaudeError(err));
    }

    if (response.stop_reason === "refusal") {
      throw new RetryableExplainError("Claude API refused the request.");
    }

    let text: string | undefined;
    for (const block of response.content) {
      if (block.type === "text") {
        text = block.text;
        break;
      }
    }
    if (!text) throw new RetryableExplainError("Claude API returned an empty response.");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new RetryableExplainError("Claude API returned invalid JSON.");
    }

    const parsed = explainResponseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new RetryableExplainError(`Claude API response failed validation: ${parsed.error.message}`);
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
 * Claude-backed counterpart to explainAdvisor.ts's getPreflopExplanation() - explains an
 * already-known, exact frequency mix in plain-language theory terms rather than computing one
 * itself. See that file for the shared rationale (same prompt builder, no-recompute contract).
 */
export async function getClaudePreflopExplanation(
  situation: AdvisorSituation,
  frequencies: StrategyMix,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new AdvisorError("Claude APIキーが設定されていません。");
  }
  const { system, user } = buildExplainPrompt(situation, frequencies);
  return requestExplanation(system, user, apiKey);
}
