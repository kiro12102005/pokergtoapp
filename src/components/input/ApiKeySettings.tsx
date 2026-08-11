"use client";

import { useState } from "react";
import { AdvisorProvider } from "@/engine/advisor/types";
import { useApiKeyStore } from "@/state/apiKeyStore";

const PROVIDERS: AdvisorProvider[] = ["gemini", "claude"];
const PROVIDER_LABEL: Record<AdvisorProvider, string> = { gemini: "Gemini", claude: "Claude" };
const PROVIDER_KEY_URL: Record<AdvisorProvider, string> = {
  gemini: "https://aistudio.google.com/apikey",
  claude: "https://console.anthropic.com/settings/keys",
};
// Gemini has a usable free tier for this app's lightweight calls; Claude doesn't - worth saying
// up front so switching providers doesn't come as a billing surprise.
const PROVIDER_NOTE: Record<AdvisorProvider, string> = {
  gemini: "無料枠があります。",
  claude: "従量課金制です(無料枠なし)。",
};

export function ApiKeySettings() {
  const {
    provider,
    setProvider,
    geminiApiKey,
    setGeminiApiKey,
    clearGeminiApiKey,
    claudeApiKey,
    setClaudeApiKey,
    clearClaudeApiKey,
  } = useApiKeyStore();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [reveal, setReveal] = useState(false);

  const apiKey = provider === "claude" ? claudeApiKey : geminiApiKey;
  const setApiKey = provider === "claude" ? setClaudeApiKey : setGeminiApiKey;
  const clearApiKey = provider === "claude" ? clearClaudeApiKey : clearGeminiApiKey;

  const providerTabs = (
    <div className="flex gap-1 rounded-lg border border-zinc-300 p-0.5 text-[11px] dark:border-zinc-700">
      {PROVIDERS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => {
            setProvider(p);
            setDraft("");
            setEditing(false);
          }}
          className={`rounded px-2 py-1 font-bold ${
            provider === p
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {PROVIDER_LABEL[p]}
        </button>
      ))}
    </div>
  );

  if (apiKey && !editing) {
    return (
      <div className="flex flex-col items-center gap-2">
        {providerTabs}
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <span>{PROVIDER_LABEL[provider]} APIキー設定済み(このブラウザにのみ保存)</span>
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setEditing(true);
            }}
            className="underline hover:no-underline"
          >
            変更
          </button>
          <button type="button" onClick={clearApiKey} className="underline hover:no-underline">
            削除
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {providerTabs}
      <div className="flex w-full flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950">
        <p className="text-amber-800 dark:text-amber-200">
          ポストフロップ分析には{PROVIDER_LABEL[provider]} APIキーが必要です({PROVIDER_NOTE[provider]})
          <a href={PROVIDER_KEY_URL[provider]} target="_blank" rel="noreferrer" className="underline">
            取得
          </a>
          して下に貼り付けてください。キーはこのブラウザにのみ保存され、サーバーには送信されません。
        </p>
        <div className="flex gap-2">
          <input
            type={reveal ? "text" : "password"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="APIキーを貼り付け"
            className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="shrink-0 rounded bg-zinc-200 px-2 dark:bg-zinc-700"
          >
            {reveal ? "隠す" : "表示"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            if (draft.trim()) {
              setApiKey(draft.trim());
              setEditing(false);
            }
          }}
          className="rounded bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700"
        >
          保存
        </button>
      </div>
    </div>
  );
}
