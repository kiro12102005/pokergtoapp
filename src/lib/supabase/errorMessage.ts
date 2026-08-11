/**
 * Maps common Supabase/Postgres error messages to a friendlier Japanese explanation, while
 * keeping the original message visible in parentheses - both as a debugging aid and as a
 * fallback for messages this doesn't specifically recognize. Supabase's raw error strings are
 * English/technical (e.g. the "Could not find the table 'public.hand_records' in the schema
 * cache" mismatched-project error this project actually hit while setting up Supabase) and
 * unhelpful to a non-technical user on their own.
 */
export function friendlySupabaseError(error: { message: string }): string {
  const message = error.message;

  if (/schema cache|could not find the table/i.test(message)) {
    return `テーブルが見つかりませんでした。Supabaseのプロジェクト設定(URL/キー)が正しいか、supabase/schema.sqlを実行済みか確認してください。(${message})`;
  }
  if (/failed to fetch|networkerror|network request failed/i.test(message)) {
    return `ネットワークに接続できませんでした。しばらくしてからもう一度お試しください。(${message})`;
  }
  if (/row-level security|permission denied/i.test(message)) {
    return `権限エラーが発生しました。ログインし直してから、もう一度お試しください。(${message})`;
  }
  if (/jwt expired|invalid jwt|invalid refresh token/i.test(message)) {
    return `セッションの有効期限が切れました。再度ログインしてください。(${message})`;
  }
  if (/unable to validate email address|invalid email/i.test(message)) {
    return `メールアドレスの形式が正しくないようです。(${message})`;
  }
  if (/you can only request this after|rate limit/i.test(message)) {
    return `リクエストが多すぎます。しばらく待ってからもう一度お試しください。(${message})`;
  }
  if (/token has expired or is invalid|otp_expired|invalid.*token/i.test(message)) {
    return `コードが正しくないか、有効期限が切れています。もう一度ログインリンクを送信してやり直してください。(${message})`;
  }

  return `エラーが発生しました。(${message})`;
}
