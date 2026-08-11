"use client";

import Link from "next/link";

/**
 * App Router error boundary for anything under this segment that throws during render - without
 * this, an uncaught error falls back to Next.js's default English error screen, which stands out
 * badly against the rest of this app's fully Japanese UI. `reset()` re-renders the segment (the
 * standard "try again" recovery Next.js provides) rather than a full page reload.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-lg font-bold">予期しないエラーが発生しました</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        ページの再読み込みをお試しください。問題が続く場合は、時間をおいてから改めてお試しください。
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
        >
          もう一度試す
        </button>
        <Link
          href="/"
          className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
