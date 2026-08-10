"use client";

import { useState } from "react";

/**
 * Renders the current situation as a single copy-pasteable text block - play-relevant facts only
 * (position, stacks, actions, board, hand - see buildExternalPrompt()), no internal persona/JSON
 * output instructions - so the user can paste it directly into an external chat AI (Gemini,
 * Claude, ...) and keep talking about the hand there, or just save it somewhere to look at later.
 * Independent of the built-in "分析する" flow: no API key or network call required to see or
 * copy it.
 */
export function PromptCopyPanel({ prompt }: { prompt: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  if (!prompt) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Common cause: clipboard access requires a secure context (https/localhost) or browser
      // permission - surface it instead of silently doing nothing, so the user knows to select
      // and copy the text below manually instead.
      setCopied(false);
      setCopyFailed(true);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-semibold text-zinc-600 hover:underline dark:text-zinc-300"
        >
          {open ? "▼" : "▶"} 入力内容をプロンプトとして表示(外部AI用)
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="shrink-0 rounded bg-zinc-200 px-3 py-1 font-bold text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
        >
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>
      <p className="text-zinc-500 dark:text-zinc-400">
        現在の入力内容をそのままGemini・Claudeなどのチャットに貼り付けて相談できる形式でまとめたものです。
      </p>
      {copyFailed && (
        <p className="text-rose-600 dark:text-rose-400">
          コピーに失敗しました。下の内容を開いて手動で選択・コピーしてください。
        </p>
      )}
      {open && (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border border-zinc-200 bg-white p-2 text-[11px] leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          {prompt}
        </pre>
      )}
    </div>
  );
}
