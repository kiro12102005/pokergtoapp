/**
 * Maps common Claude (Anthropic) API errors to a friendlier Japanese explanation, mirroring
 * src/lib/gemini/errorMessage.ts's pattern (keep the original text visible, for debugging and
 * as a fallback for anything not specifically recognized). The Anthropic SDK's error classes
 * expose a numeric `status` field, which is a more reliable signal than message text, but we
 * also fall back to matching the message so a plain object or a differently-shaped error still
 * gets classified.
 */
export function friendlyClaudeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const status = err && typeof err === "object" && "status" in err ? (err as { status?: unknown }).status : undefined;

  if (status === 429 || /rate_limit/i.test(message)) {
    return `Claude APIの利用上限(レート制限)に達しました。しばらく待ってから、もう一度お試しください。(${message})`;
  }
  if (status === 401 || status === 403 || /authentication_error|permission_error|invalid x-api-key/i.test(message)) {
    return `Claude APIキーが無効なようです。設定画面でキーを確認してください。(${message})`;
  }
  if (status === 500 || status === 529 || /overloaded_error|internal_server/i.test(message)) {
    return `Claude APIが一時的に利用できないようです。しばらく待ってから、もう一度お試しください。(${message})`;
  }
  if (/aborted|timeout/i.test(message)) {
    return `Claude APIへの接続がタイムアウトしました。しばらくしてからもう一度お試しください。(${message})`;
  }

  return `Claude APIのリクエストに失敗しました。(${message})`;
}
