"use client";

import { useEffect } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { HandRecordCard } from "@/components/history/HandRecordCard";
import { useAuthStore } from "@/state/authStore";
import { useHistoryStore } from "@/state/historyStore";

export default function HistoryPage() {
  const { session, init } = useAuthStore();
  const { records, loading, error, fetchRecords, deleteRecord } = useHistoryStore();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (session) void fetchRecords();
  }, [session, fetchRecords]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-bold">ハンド分析履歴</h1>
        <p className="max-w-md text-center text-xs text-zinc-500 dark:text-zinc-400">
          分析ページで保存したハンドの入力内容・解析結果・外部AI用プロンプートをまとめて振り返れます。
        </p>
      </header>

      <AuthPanel />

      {session && (
        <>
          {loading && <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">読み込み中...</p>}
          {error && (
            <div className="rounded-lg border border-rose-400 bg-rose-50 p-3 text-center text-xs text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200">
              {error}
            </div>
          )}
          {!loading && records.length === 0 && !error && (
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              まだ保存された記録がありません。分析ページで「履歴に保存」を押すとここに表示されます。
            </p>
          )}
          <div className="flex flex-col gap-2">
            {records.map((record) => (
              <HandRecordCard key={record.id} record={record} onDelete={(id) => void deleteRecord(id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
