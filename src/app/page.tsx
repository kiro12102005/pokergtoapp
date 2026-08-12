import Link from "next/link";
import { CHANGELOG } from "@/data/changelog";

const FEATURES = [
  {
    href: "/train",
    suit: "♠",
    suitColor: "text-zinc-800 dark:text-zinc-200",
    title: "練習",
    description: "プリフロップは事前計算ソルバーでクイズ形式、ポストフロップはAIの評価付きで練習できます。",
  },
  {
    href: "/analyze",
    suit: "♦",
    suitColor: "text-rose-600 dark:text-rose-400",
    title: "分析",
    description:
      "ハンド履歴を貼り付けるだけで入力完了。自社計算のGTOベースラインと、AIによるエクスプロイト視点の両方で振り返れます。",
  },
  {
    href: "/history",
    suit: "♣",
    suitColor: "text-zinc-800 dark:text-zinc-200",
    title: "履歴・傾向分析",
    description:
      "分析結果を保存し、外部AIに相談した回答をタグ付きでハンドノートに。ストリート/ポジション別の傾向分析や弱点練習も。",
  },
  {
    href: "/help",
    suit: "♥",
    suitColor: "text-rose-600 dark:text-rose-400",
    title: "使い方",
    description: "GTOとエクスプロイトの違いや日本語ポーカー用語辞典など、使い方をまとめています。迷ったらまずここ。",
  },
] as const;

const latestUpdate = CHANGELOG[0];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(16,185,129,0.16),transparent_70%)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(16,185,129,0.14),transparent_70%)]"
      />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-9 px-6 py-16 text-center">
        <div aria-hidden className="flex items-center gap-3 text-2xl tracking-widest">
          <span className="text-zinc-700 dark:text-zinc-300">♠</span>
          <span className="text-rose-500 dark:text-rose-400">♥</span>
          <span className="text-zinc-700 dark:text-zinc-300">♣</span>
          <span className="text-rose-500 dark:text-rose-400">♦</span>
        </div>

        <div className="flex flex-col items-center gap-4">
          <span className="rounded-full border border-emerald-600/30 bg-emerald-600/10 px-3 py-1 text-[11px] font-bold tracking-widest text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
            CLUB MATCH & RING GAME
          </span>
          <h1 className="max-w-xl text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
            クラブマッチ・リングキャッシュ対応
            <br />
            GTO / エクスプロイト トレーナー
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            プリフロップは事前計算済みソルバーの厳密解、ポストフロップは自社計算のGTOベースラインにAIのエクスプロイト視点を上乗せ。実戦ハンドはハンド履歴の貼り付けで入力でき、外部AIに相談した回答もタグ付きでハンドノートとして残せます。
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/train"
            className="rounded-xl bg-emerald-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-emerald-600/35"
          >
            練習を始める
          </Link>
          <Link
            href="/analyze"
            className="rounded-xl border border-zinc-300 bg-white px-7 py-3 text-sm font-bold text-zinc-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600"
          >
            シチュエーションを分析する
          </Link>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group flex flex-col items-start gap-2 rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-600/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-400/40"
            >
              <span aria-hidden className={`text-2xl ${f.suitColor}`}>
                {f.suit}
              </span>
              <span className="font-bold text-zinc-900 dark:text-zinc-50">{f.title}</span>
              <span className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{f.description}</span>
            </Link>
          ))}
        </div>

        {latestUpdate && (
          <Link
            href="/updates"
            className="group flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white/60 px-4 py-3 text-left text-xs shadow-sm transition-all hover:border-emerald-600/40 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                最新のお知らせ
              </span>
              <span className="truncate font-semibold text-zinc-700 dark:text-zinc-200">{latestUpdate.title}</span>
            </span>
            <span className="shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 dark:text-zinc-500">
              →
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
