/**
 * Maps common Gemini API error messages to a friendlier Japanese explanation, mirroring
 * src/lib/supabase/errorMessage.ts's pattern (keep the original text visible, for debugging and
 * as a fallback for anything not specifically recognized). The SDK surfaces the underlying HTTP
 * error's message largely as-is (often containing the gRPC-style status name), so matching on
 * those names/codes is more reliable than matching on exact wording.
 */
export function friendlyGeminiError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  if (/RESOURCE_EXHAUSTED|429|quota/i.test(message)) {
    return `Gemini APIの利用上限(レート制限)に達しました。しばらく待ってから、もう一度お試しください。(${message})`;
  }
  if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|403/i.test(message)) {
    return `Gemini APIキーが無効なようです。設定画面でキーを確認してください。(${message})`;
  }
  if (/UNAVAILABLE|503|internal error|500/i.test(message)) {
    return `Gemini APIが一時的に利用できないようです。しばらく待ってから、もう一度お試しください。(${message})`;
  }

  return `Gemini APIのリクエストに失敗しました。(${message})`;
}
