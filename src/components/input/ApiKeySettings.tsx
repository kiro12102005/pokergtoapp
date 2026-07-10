"use client";

import { useState } from "react";
import { useApiKeyStore } from "@/state/apiKeyStore";

export function ApiKeySettings() {
  const { geminiApiKey, setGeminiApiKey, clearGeminiApiKey } = useApiKeyStore();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [reveal, setReveal] = useState(false);

  if (geminiApiKey && !editing) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        <span>Gemini APIキー設定済み(このブラウザにのみ保存)</span>
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
        <button type="button" onClick={clearGeminiApiKey} className="underline hover:no-underline">
          削除
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950">
      <p className="text-amber-800 dark:text-amber-200">
        ポストフロップ分析にはGemini APIキーが必要です。
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          無料で取得
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
            setGeminiApiKey(draft.trim());
            setEditing(false);
          }
        }}
        className="rounded bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700"
      >
        保存
      </button>
    </div>
  );
}
