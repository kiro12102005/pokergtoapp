"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cardToDisplayString } from "@/domain/cards/card";
import { STREET_LABEL_JA } from "@/domain/scenario/labels";
import { AdvisorResultPanel } from "@/components/feedback/AdvisorResultPanel";
import { PromptCopyPanel } from "@/components/feedback/PromptCopyPanel";
import { handRecordFromRow, HandRecord, HandRecordRow } from "@/engine/history/handRecord";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * A public, read-only view of one shared hand - no login required. Reachable only for a record
 * whose owner has explicitly turned sharing on (see HandRecordCard.tsx's toggle and
 * hand_records_select_public in supabase/schema.sql); anything else (unshared, deleted, wrong id)
 * renders the same "not found" state rather than distinguishing why, since there's nothing a
 * visitor could do differently either way.
 */
export default function SharedHandPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = useState<HandRecord | null>(null);
  // Only actually loading when there's a real fetch to do - the "Supabase isn't configured" case
  // is a static fact (isSupabaseConfigured), checked directly in render, not tracked as state.
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("hand_records")
        .select("id, created_at, memo, snapshot, results, external_prompt, is_public")
        .eq("id", id)
        .eq("is_public", true)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
      } else {
        setRecord(handRecordFromRow(data as HandRecordRow));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-bold">共有されたハンド</h1>
        <p className="max-w-md text-center text-xs text-zinc-500 dark:text-zinc-400">
          リンクを知っている人だけが見られる読み取り専用ページです。
        </p>
      </header>

      {!isSupabaseConfigured && (
        <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Supabaseが設定されていません。
        </div>
      )}

      {isSupabaseConfigured && loading && (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">読み込み中...</p>
      )}

      {isSupabaseConfigured && !loading && notFound && (
        <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          この記録は見つからないか、共有が解除されています。
        </div>
      )}

      {record && (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-bold text-zinc-900 dark:text-zinc-50">{STREET_LABEL_JA[record.snapshot.street]}</span>
            <span className="font-mono">{record.snapshot.heroCards.map(cardToDisplayString).join(" ")}</span>
            <span>
              {record.snapshot.heroPosition} / {record.snapshot.effectiveStackBB}BB
            </span>
            <span>ポット {record.snapshot.potBB.toFixed(1)}BB</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {(record.snapshot.format ?? "tournament") === "cash" ? "リングキャッシュ" : "クラブマッチ"}
            </span>
          </div>
          {record.memo && <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">{record.memo}</p>}

          <AdvisorResultPanel results={record.results} />
          <PromptCopyPanel prompt={record.externalPrompt} />

          <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
            <Link href="/" className="underline">
              このアプリについて
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
