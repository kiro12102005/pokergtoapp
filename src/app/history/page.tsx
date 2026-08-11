"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { HandRecordCard } from "@/components/history/HandRecordCard";
import { STREET_LABEL_JA } from "@/domain/scenario/labels";
import { Street } from "@/domain/scenario/scenarioState";
import { PREFLOP_ACTION_ORDER } from "@/domain/table/seats";
import { DEFAULT_HISTORY_FILTER, HistoryFilter, hasActiveFilter, recordMatchesFilter } from "@/engine/history/filterRecords";
import { recordsToCsv, recordsToJson } from "@/engine/history/exportRecords";
import { downloadTextFile } from "@/lib/downloadFile";
import { useAuthStore } from "@/state/authStore";
import { useHistoryStore } from "@/state/historyStore";

const STREET_FILTER_OPTIONS: Street[] = ["preflop", "flop", "turn", "river"];
const SELECT_CLASS =
  "rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900";

export default function HistoryPage() {
  const { session, init } = useAuthStore();
  const {
    records,
    loading,
    loadingMore,
    hasMore,
    error,
    fetchRecords,
    loadMore,
    deleteRecord,
    fetchStatsRecords,
    toggleShare,
    statsRecords,
    statsLoading,
    statsError,
  } = useHistoryStore();
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>(DEFAULT_HISTORY_FILTER);
  const filterActive = hasActiveFilter(filter);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (session) void fetchRecords();
  }, [session, fetchRecords]);

  useEffect(() => {
    // Filtering needs to search the whole history, not just the paginated page currently
    // loaded - switch to the same unpaginated fetch export already uses (see fetchStatsRecords),
    // fetched once and reused for as long as a filter stays active.
    if (session && filterActive && !statsRecords) void fetchStatsRecords();
  }, [session, filterActive, statsRecords, fetchStatsRecords]);

  const filteredRecords = useMemo(
    () => (statsRecords ?? []).filter((r) => recordMatchesFilter(r, filter)),
    [statsRecords, filter]
  );

  const handleExport = async (format: "json" | "csv") => {
    setExporting(format);
    try {
      // Export always wants everything, not just the paginated /history view - fetchStatsRecords
      // already fetches unpaginated (up to its own cap), so it's reused here rather than adding
      // a third near-identical fetch method.
      await fetchStatsRecords();
      const all = useHistoryStore.getState().statsRecords ?? [];
      const date = new Date().toISOString().slice(0, 10);
      if (format === "json") {
        downloadTextFile(`pokergto-history-${date}.json`, recordsToJson(all), "application/json");
      } else {
        downloadTextFile(`pokergto-history-${date}.csv`, recordsToCsv(all), "text/csv");
      }
    } finally {
      setExporting(null);
    }
  };

  // While a filter is active, the list/loading/error trio all come from the unpaginated
  // statsRecords fetch instead of the normal paginated records/loading/error - see the effect
  // above.
  const displayedRecords = filterActive ? filteredRecords : records;
  const listLoading = filterActive ? statsLoading : loading;
  const listError = filterActive ? statsError : error;

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
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/history/stats"
              className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700"
            >
              傾向分析(リークファインダー)を見る
            </Link>
            <button
              type="button"
              onClick={() => void handleExport("json")}
              disabled={exporting !== null}
              className="rounded-lg bg-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
            >
              {exporting === "json" ? "書き出し中..." : "JSONでエクスポート"}
            </button>
            <button
              type="button"
              onClick={() => void handleExport("csv")}
              disabled={exporting !== null}
              className="rounded-lg bg-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
            >
              {exporting === "csv" ? "書き出し中..." : "CSVでエクスポート"}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950">
            <select
              value={filter.position}
              onChange={(e) => setFilter((f) => ({ ...f, position: e.target.value as HistoryFilter["position"] }))}
              className={SELECT_CLASS}
            >
              <option value="all">ポジション: すべて</option>
              {PREFLOP_ACTION_ORDER.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={filter.street}
              onChange={(e) => setFilter((f) => ({ ...f, street: e.target.value as HistoryFilter["street"] }))}
              className={SELECT_CLASS}
            >
              <option value="all">ストリート: すべて</option>
              {STREET_FILTER_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STREET_LABEL_JA[s]}
                </option>
              ))}
            </select>
            <select
              value={filter.match}
              onChange={(e) => setFilter((f) => ({ ...f, match: e.target.value as HistoryFilter["match"] }))}
              className={SELECT_CLASS}
            >
              <option value="all">一致状況: すべて</option>
              <option value="matched">推奨と一致のみ</option>
              <option value="mismatched">推奨と不一致のみ</option>
            </select>
            {filterActive && (
              <button
                type="button"
                onClick={() => setFilter(DEFAULT_HISTORY_FILTER)}
                className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
              >
                絞り込み解除
              </button>
            )}
          </div>

          {listLoading && <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">読み込み中...</p>}
          {listError && (
            <div className="rounded-lg border border-rose-400 bg-rose-50 p-3 text-center text-xs text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200">
              {listError}
            </div>
          )}
          {!listLoading && displayedRecords.length === 0 && !listError && (
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              {filterActive
                ? "条件に一致する記録が見つかりません。"
                : "まだ保存された記録がありません。分析ページで「履歴に保存」を押すとここに表示されます。"}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {displayedRecords.map((record) => (
              <HandRecordCard
                key={record.id}
                record={record}
                onDelete={(id) => void deleteRecord(id)}
                onToggleShare={(id, isPublic) => void toggleShare(id, isPublic)}
              />
            ))}
          </div>

          {!filterActive && hasMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="self-center rounded-lg bg-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
            >
              {loadingMore ? "読み込み中..." : "もっと読み込む"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
