"use client";

import { useState } from "react";
import { HandHistoryParseError, parseHandHistory } from "@/engine/import/handHistoryParser";
import { useAnalyzeStore } from "@/state/analyzeStore";

/**
 * Lets the user paste a PokerStars-format hand history (the format most training/review tools
 * also export) and fills in the whole draft below via loadFromSnapshot(), instead of clicking
 * through every position/card/action manually - see handHistoryParser.ts. 6-max only, matching
 * this app's fixed Position model; other formats/table sizes get a clear error rather than a
 * silently-wrong import.
 */
export function HandHistoryImportPanel() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const loadFromSnapshot = useAnalyzeStore((s) => s.loadFromSnapshot);

  const handleImport = () => {
    setError(null);
    setImported(false);
    try {
      const snapshot = parseHandHistory(text);
      loadFromSnapshot(snapshot);
      setImported(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof HandHistoryParseError ? err.message : "ハンド履歴を読み取れませんでした。");
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-950">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-left font-semibold text-zinc-600 hover:underline dark:text-zinc-300"
      >
        {open ? "▼" : "▶"} ハンド履歴を貼り付けて取り込む(PokerStars形式・6人打ちのみ)
      </button>
      {imported && !open && (
        <p className="text-emerald-700 dark:text-emerald-400">取り込みました。下の入力内容が置き換わっています。</p>
      )}
      {open && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="PokerStars Hand #... から始まるハンド履歴テキストを貼り付け"
            rows={6}
            className="rounded border border-zinc-300 bg-white p-2 font-mono text-[11px] text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          {error && (
            <p className="text-rose-600 dark:text-rose-400">{error}</p>
          )}
          <button
            type="button"
            onClick={handleImport}
            disabled={!text.trim()}
            className="self-start rounded bg-zinc-700 px-3 py-1.5 font-bold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            取り込む
          </button>
        </>
      )}
    </div>
  );
}
