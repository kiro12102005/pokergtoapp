"use client";

import { useState } from "react";
import { cardToDisplayString } from "@/domain/cards/card";
import { STREET_LABEL_JA } from "@/domain/scenario/labels";
import { HandRecord } from "@/engine/history/handRecord";
import { AdvisorResultPanel } from "@/components/feedback/AdvisorResultPanel";
import { PromptCopyPanel } from "@/components/feedback/PromptCopyPanel";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}

/** One collapsed-by-default hand history entry: a one-line summary (street/hand/position/stack/
 *  pot/date) that expands to the full saved results (via AdvisorResultPanel), the saved
 *  external-AI prompt (via PromptCopyPanel), and a public/private share toggle. */
export function HandRecordCard({
  record,
  onDelete,
  onToggleShare,
}: {
  record: HandRecord;
  onDelete: (id: string) => void;
  onToggleShare: (id: string, isPublic: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { snapshot } = record;
  const heroHandStr = snapshot.heroCards.map(cardToDisplayString).join(" ");
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/shared/${record.id}` : "";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white p-3 text-sm shadow dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-wrap items-center justify-between gap-2 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">
            {open ? "▼" : "▶"} {STREET_LABEL_JA[snapshot.street]}
          </span>
          <span className="font-mono">{heroHandStr}</span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {snapshot.heroPosition} / {snapshot.effectiveStackBB}BB
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">ポット {snapshot.potBB.toFixed(1)}BB</span>
          {record.isPublic && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              共有中
            </span>
          )}
        </div>
        <span className="shrink-0 text-zinc-400 dark:text-zinc-500">{formatDate(record.createdAt)}</span>
      </button>

      {record.memo && <p className="text-zinc-500 dark:text-zinc-400">{record.memo}</p>}

      {open && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <AdvisorResultPanel results={record.results} />
          <PromptCopyPanel prompt={record.externalPrompt} />

          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={record.isPublic}
                onChange={(e) => onToggleShare(record.id, e.target.checked)}
              />
              リンクを知っている人に共有する(ログイン不要で閲覧可能になります)
            </label>
            {record.isPublic && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className="shrink-0 rounded bg-zinc-200 px-3 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                >
                  {copied ? "コピーしました" : "コピー"}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (window.confirm("この記録を削除しますか？")) onDelete(record.id);
            }}
            className="self-end rounded bg-rose-100 px-3 py-1 font-bold text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900"
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}
