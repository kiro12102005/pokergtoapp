"use client";

import { useEffect } from "react";
import { CHANGELOG } from "@/data/changelog";
import { useChangelogStore } from "@/state/changelogStore";

export default function UpdatesPage() {
  const markSeen = useChangelogStore((s) => s.markSeen);

  useEffect(() => {
    if (CHANGELOG[0]) markSeen(CHANGELOG[0].date);
  }, [markSeen]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-bold">お知らせ</h1>
        <p className="max-w-md text-center text-xs text-zinc-500 dark:text-zinc-400">
          このアプリのアップデート履歴です。
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {CHANGELOG.map((entry, i) => (
          <div
            key={`${entry.date}-${i}`}
            className="flex flex-col gap-1 rounded-lg border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {entry.date}
              </span>
            </div>
            <div className="font-bold text-zinc-900 dark:text-zinc-50">{entry.title}</div>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{entry.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
