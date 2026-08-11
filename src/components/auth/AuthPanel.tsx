"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthStore } from "@/state/authStore";

/**
 * Email magic-link sign-in/sign-out widget - no password, so the only setup cost is a Supabase
 * project (see README). Used by /history to gate saving/viewing hand records, since those are
 * synced to the cloud (unlike the rest of this app's browser-local-only state).
 */
export function AuthPanel() {
  const {
    session,
    initialized,
    sendingLink,
    verifyingCode,
    linkSentTo,
    error,
    init,
    signInWithEmail,
    verifyEmailCode,
    signOut,
  } = useAuthStore();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    init();
  }, [init]);

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        履歴機能を使うにはSupabaseの設定が必要です(README参照)。
      </div>
    );
  }

  if (!initialized) return null;

  if (session) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        <span>{session.user.email} でログイン中</span>
        <button type="button" onClick={() => void signOut()} className="underline hover:no-underline">
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950">
      <p className="text-amber-800 dark:text-amber-200">
        ハンド履歴の保存・閲覧にはログインが必要です。メールアドレス宛にログイン用リンクを送ります(パスワード不要)。
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={() => email.trim() && void signInWithEmail(email.trim())}
          disabled={sendingLink || !email.trim()}
          className="shrink-0 rounded bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {sendingLink ? "送信中..." : "ログインリンクを送る"}
        </button>
      </div>
      {linkSentTo && (
        <p className="text-emerald-700 dark:text-emerald-300">
          {linkSentTo} にログインリンクを送信しました。メール内のリンクを開くか、下の「コードでログイン」をお使いください。
        </p>
      )}

      {/* Always rendered (not gated behind linkSentTo) - linkSentTo only lives in memory, so
       *  switching to the Mail app to read the code and coming back can get this page reloaded
       *  by the OS in between, silently wiping that state. A user who then can't find anywhere
       *  to type the code they already have is worse than one extra tap to open this section. */}
      <details className="rounded border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900" open={Boolean(linkSentTo)}>
        <summary className="cursor-pointer font-semibold text-zinc-600 dark:text-zinc-300">
          コードでログイン(ホーム画面に追加している場合はこちら)
        </summary>
        <div className="mt-2 flex flex-col gap-1">
          <p className="text-zinc-500 dark:text-zinc-400">
            ホーム画面に追加(PWA)して使っている場合、メール内のリンクがブラウザ側で開いてしまいログインが反映されないことがあります。その場合はメールに記載のコードとメールアドレスをここに入力してください。
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="コード"
              className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="button"
              onClick={() => email.trim() && code.trim() && void verifyEmailCode(email.trim(), code.trim())}
              disabled={verifyingCode || !email.trim() || !code.trim()}
              className="shrink-0 rounded bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {verifyingCode ? "確認中..." : "コードでログイン"}
            </button>
          </div>
        </div>
      </details>
      {error && <p className="text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  );
}
