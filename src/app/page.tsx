import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 p-8 text-center dark:bg-zinc-950">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Poker Chase クラブマッチ GTOトレーナー
      </h1>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        6人打ちクラブマッチ形式に特化したプリフロップ練習アプリ(Phase 1)。
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/train"
          className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700"
        >
          練習を始める
        </Link>
        <Link
          href="/analyze"
          className="rounded-lg bg-zinc-800 px-6 py-3 text-sm font-bold text-white hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          シチュエーションを分析する
        </Link>
      </div>
    </div>
  );
}
